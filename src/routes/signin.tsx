import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { BrandMark } from "@/components/site/primitives";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign In to Track Your Civic Reports — CivicPulse" },
      {
        name: "description",
        content:
          "Sign in as a citizen to track your civic reports, or as municipal staff to access the report management portal.",
      },
      { property: "og:title", content: "Sign In to Track Your Civic Reports — CivicPulse" },
      { property: "og:description", content: "Citizen and municipal staff sign-in for CivicPulse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignIn;
});

function SignIn() {
  return null;
}
