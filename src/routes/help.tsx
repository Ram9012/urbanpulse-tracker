import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/site-layout";
import { Section } from "@/components/site/primitives";
import { BRAND } from "@/lib/civic-data";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center, Privacy and Accessibility — CivicPulse" },
      {
        name: "description",
        content:
          "Answers about reporting civic issues, tracking IDs, privacy controls, accessibility support and how to contact the municipal helpline.",
      },
      { property: "og:title", content: "Help Center, Privacy and Accessibility — CivicPulse" },
      {
        property: "og:description",
        content:
          "Guidance for citizens and staff: reporting, tracking, privacy, accessibility and support contacts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Help,
});

const FAQS = [
  {
    q: "How long does reporting take?",
    a: "Most reports take under a minute: add a photo, confirm the detected location, add a short text or voice description, and submit.",
  },
  {
    q: "What is a tracking ID?",
    a: "Every report gets an ID like CIV-10482. Use it on your dashboard or the report page to follow each status change.",
  },
  {
    q: "Can I report without sharing my name?",
    a: "Yes. Choose anonymous reporting and your name is hidden from public pages. Staff still see the report so they can act on it.",
  },
  {
    q: "What happens if someone already reported the same issue?",
    a: "We check nearby reports of the same category and time window. You can confirm an existing report instead of creating a duplicate, which raises its priority signal.",
  },
  {
    q: "Does it work without internet?",
    a: "Yes. Reports are saved on your device with their media, queued, and uploaded automatically when you are back online. Duplicate submissions are prevented during sync.",
  },
  {
    q: "Which languages are supported?",
    a: "English, Kannada and Hindi input, including voice descriptions that are converted to text you can edit.",
  },
];

function Help() {
  return (
    <SiteLayout>
      <Section
        eyebrow="Help center"
        title="How Can We Help?"
        description="Common questions from citizens and municipal staff."
      >
        <dl className="mx-auto grid max-w-3xl gap-4">
          {FAQS.map((f) => (
            <div key={f.q} className="surface-card p-5">
              <dt className="text-base font-bold">{f.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        className="bg-surface border-y border-border"
        align="left"
        title="Privacy, terms and accessibility"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <article className="surface-card p-6">
            <h3 className="text-base font-bold">Privacy policy</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Location data is used only to route and resolve your report.</li>
              <li>Contact details are never published on public pages.</li>
              <li>Media is stored with restricted, role-based access.</li>
              <li>You can request deletion of your account and reports.</li>
            </ul>
          </article>
          <article className="surface-card p-6">
            <h3 className="text-base font-bold">Terms of service</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Report genuine civic issues in your area.</li>
              <li>Do not upload media containing identifiable private information.</li>
              <li>Emergencies must go to official emergency numbers first.</li>
              <li>Abusive or false reports may be removed.</li>
            </ul>
          </article>
          <article className="surface-card p-6">
            <h3 className="text-base font-bold">Accessibility</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Full keyboard navigation with visible focus states.</li>
              <li>Status is conveyed with text and icons, never colour alone.</li>
              <li>Reduced-motion preferences are respected.</li>
              <li>Touch targets are at least 44 pixels.</li>
            </ul>
          </article>
        </div>
      </Section>

      <Section align="left" title="Contact support">
        <div className="surface-card max-w-xl p-6">
          <p className="text-sm text-muted-foreground">
            For help with a specific report, keep your tracking ID handy.
          </p>
          <ul className="mt-4 space-y-2 text-sm font-semibold">
            <li>Email: {BRAND.email}</li>
            <li>Helpline: {BRAND.phone}</li>
            <li>Municipal office: {BRAND.city}</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/report"
              className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
            >
              Report an issue
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 text-sm font-bold hover:bg-accent"
            >
              Track my reports
            </Link>
          </div>
        </div>
      </Section>
    </SiteLayout>
  );
}
