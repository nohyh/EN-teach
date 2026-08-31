import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#eef1f8" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="role" />
      <Stack.Screen name="home" />
      <Stack.Screen name="learn" />
      <Stack.Screen name="ai" />
      <Stack.Screen name="homework" />
      <Stack.Screen name="growth" />
    </Stack>
  );
}
