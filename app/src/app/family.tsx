import { SafeAreaView } from "react-native-safe-area-context";

import FamilyApp from "@/screens/FamilyApp.dom";
import { getApiBaseUrl } from "@/services/api";

export default function FamilyRoute() {
  return <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#f5f3ee" }}><FamilyApp apiBaseUrl={getApiBaseUrl()} dom={{ style: { flex: 1, width: "100%" } }} /></SafeAreaView>;
}
