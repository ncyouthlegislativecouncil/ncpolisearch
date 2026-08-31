import type { Metadata } from "next";
import MapExplorer from "../../components/map/MapExplorer";
import { getDistrictPartyMap } from "../../lib/district";
import { safeQuery } from "../../lib/safe";

export const metadata: Metadata = {
  title: "District Map · NCPoliSearch",
  description:
    "Interactive map of North Carolina House and Senate legislative districts. Click a district to see its representative.",
};

export default async function MapPage() {
  // The party tint for every district is cheap to compute and lets the map color
  // itself immediately on load, before any district is clicked. Falls back to
  // an untinted map (still fully usable — clicking a district still works)
  // rather than failing the whole page/build if the DB is briefly unreachable.
  const partyMap = await safeQuery(
    () => getDistrictPartyMap(),
    { house: {}, senate: {} },
    "map:getDistrictPartyMap"
  );
  return <MapExplorer partyMap={partyMap} />;
}
