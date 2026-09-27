import type { Metadata } from "next";
import SearchForm from "@/components/SearchForm";

export const metadata: Metadata = {
  title: "New search — Starling",
  description: "Pick a network and enter a handle to open its graph.",
};

export default function SearchPage() {
  return <SearchForm />;
}
