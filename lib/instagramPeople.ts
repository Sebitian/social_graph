import type { GraphData, GraphLink, GraphNode, ScrapeResult } from "./types";

export type InstagramMode = "person" | "company";

export interface InstagramPersonOption {
  id: string;
  username: string;
  fullName: string;
  title?: string;
  profilePicUrl?: string;
  followersCount?: number;
  available: boolean;
  unavailableReason?: string;
  result: ScrapeResult | null;
}

export interface InstagramPeopleResult {
  kind: "instagram-people";
  scrapedAt: number;
  companyHandle: string;
  people: InstagramPersonOption[];
}

export function isInstagramPeopleResult(
  value: unknown,
): value is InstagramPeopleResult {
  if (!value || typeof value !== "object") return false;
  const row = value as InstagramPeopleResult;
  return row.kind === "instagram-people" && Array.isArray(row.people);
}

export function firstAvailableInstagramPersonId(
  data: InstagramPeopleResult | null | undefined,
): string {
  return data?.people.find((person) => person.available)?.id ?? "";
}

export function instagramPersonById(
  data: InstagramPeopleResult | null | undefined,
  id: string,
): InstagramPersonOption | null {
  if (!data || !id) return null;
  return data.people.find((person) => person.id === id) ?? null;
}

export const INSTAGRAM_EMPLOYEE_COLOR = "#f5c542";

function personKey(value: string | undefined): string {
  return (value ?? "").replace(/^@/, "").trim().toLowerCase();
}

export function instagramPersonForNode(
  data: InstagramPeopleResult | null | undefined,
  node: Pick<GraphNode, "id" | "label"> | null | undefined,
): InstagramPersonOption | null {
  if (!data || !node) return null;
  const keys = [personKey(node.id), personKey(node.label)].filter(Boolean);
  return (
    data.people.find((person) => {
      const username = personKey(person.username);
      const id = personKey(person.id);
      return keys.includes(username) || keys.includes(id);
    }) ?? null
  );
}

function linkEndId(end: GraphLink["source"] | GraphLink["target"]): string {
  return typeof end === "string" ? end : String(end);
}

export function nodeHasEngagement(node: GraphNode): boolean {
  if (node.group === "self") return true;
  return (node.comments ?? 0) > 0 || (node.reactionsTotal ?? 0) > 0;
}

/** Drop members with no comments and no reactions. */
export function pruneQuietMemberNodes(graph: GraphData): GraphData {
  const keep = new Set(
    graph.nodes.filter(nodeHasEngagement).map((node) => node.id),
  );
  if (keep.size === graph.nodes.length) return graph;

  const nodes = graph.nodes.filter((node) => keep.has(node.id));
  const links = graph.links.filter(
    (link) => keep.has(linkEndId(link.source)) && keep.has(linkEndId(link.target)),
  );
  const remainingClusters = new Set(
    nodes
      .map((node) => node.clusterId)
      .filter((id): id is number => id != null && id >= 0),
  );
  const circles = (graph.circles ?? []).filter((circle) =>
    remainingClusters.has(circle.id),
  );
  return { ...graph, nodes, links, circles };
}

/** Make sure every rostered employee appears on the company map. */
export function attachInstagramEmployeesToGraph(
  graph: GraphData,
  people: InstagramPeopleResult | null | undefined,
): GraphData {
  if (!people?.people.length) return graph;

  const existing = new Set(graph.nodes.map((node) => personKey(node.id)));
  const self = graph.nodes.find((node) => node.group === "self");
  const extras: GraphNode[] = [];
  const extraLinks: GraphLink[] = [];

  for (const person of people.people) {
    const id = personKey(person.username) || personKey(person.id);
    if (!id || existing.has(id)) continue;

    extras.push({
      id,
      label: person.username,
      fullName: person.fullName,
      group: "member",
      circle: 1,
      clusterId: -1,
      comments: 0,
      val: person.available ? 16 : 10,
      profilePicUrl: person.profilePicUrl,
      position: person.title,
      presenceScore: person.available ? 0.82 : 0.35,
    });

    if (self) {
      extraLinks.push({
        source: self.id,
        target: id,
        kind: "comment",
        inbound: 0,
        outbound: 0,
      });
    }
    existing.add(id);
  }

  if (!extras.length) return graph;
  return {
    ...graph,
    nodes: [...graph.nodes, ...extras],
    links: [...graph.links, ...extraLinks],
  };
}
