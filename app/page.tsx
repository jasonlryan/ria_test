import { redirect } from "next/navigation";

export default function Home() {
  console.log("ROOT PAGE LOADED - REDIRECTING TO EMBED");
  // This is a server component with an immediate redirect
  redirect("/embed/asst_f3NgFGr4gfTt6z6tCzDX6TYG");

  // The below code won't execute due to the redirect
  return null;
}
