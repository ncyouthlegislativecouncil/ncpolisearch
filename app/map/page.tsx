import type { Metadata } from "next";
import MapExplorer from "../../components/map/MapExplorer";
import { getDistrictPartyMap } from "../../lib/district";

export const metadata: Metadata = {
  title: "District Map · NCPoliSearch",
  description:
    "Interactive map of North Carolina House and Senate legislative districts. Click a district to see its representative.",
};

export default async function MapPage() {
  // The party tint for every district is cheap to compute and lets the map color
  // itself immediately on load, before any district is clicked.
  const partyMap = await getDistrictPartyMap();
  return <MapExplorer partyMap={partyMap} />;
}
