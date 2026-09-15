import { SafeAreaView } from "react-native-safe-area-context";

import ContentAdmin from "@/screens/ContentAdmin.dom";
import { getApiBaseUrl } from "@/services/api";

export default function ContentAdminRoute() {
  return <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#f3f4f8" }}><ContentAdmin apiBaseUrl={getApiBaseUrl()} dom={{ style: { flex: 1, width: "100%" } }} /></SafeAreaView>;
}
