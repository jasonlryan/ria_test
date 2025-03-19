import { redirect } from "next/navigation";

export default function Home() {
  console.log("ROOT PAGE LOADED - REDIRECTING TO EMBED");
  // This is a server component with an immediate redirect
  redirect(
    `/embed/${
      process.env.OPENAI_ASSISTANT_ID || "asst_xOd6VeXqgta6bxY1LkatulKU"
    }`
  );

  // The below code won't execute due to the redirect
  return null;
}
