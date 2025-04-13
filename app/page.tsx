import { redirect } from "next/navigation";

export default function Home() {
  redirect(
    `/embed/${
      process.env.NEW_ASSISTANT_ID ||
      process.env.OPENAI_ASSISTANT_ID ||
      "asst_D0BPAJjvg3UK6Lcb1lqIM1xS"
    }`
  );
}
