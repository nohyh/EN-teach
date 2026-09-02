import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return <SafeAreaProvider><StatusBar hidden={false} style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#eef1f8" } }} /></SafeAreaProvider>;
}
