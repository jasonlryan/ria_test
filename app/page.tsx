import { redirect } from "next/navigation";

export default function Home() {
  console.log("ROOT PAGE LOADED - REDIRECTING TO EMBED");
  // This is a server component with an immediate redirect

  // Original code:
  // redirect(
  //   `/embed/${
  //     process.env.OPENAI_ASSISTANT_ID || "asst_xOd6VeXqgta6bxY1LkatulKU"
  //   }`
  // );

  redirect(
    `/embed/${
      process.env.NEW_ASSISTANT_ID ||
      process.env.OPENAI_ASSISTANT_ID ||
      "asst_D0BPAJjvg3UK6Lcb1lqIM1xS"
    }`
  );

  // The below code won't execute due to the redirect
  return null;
}
