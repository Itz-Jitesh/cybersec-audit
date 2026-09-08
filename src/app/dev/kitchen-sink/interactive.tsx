"use client";

import { useState } from "react";

import { InlineEditableText } from "@/components/shared/inline-editable-text";
import { LabelChip } from "@/components/shared/label-chip";
import { Button } from "@/components/ui/button";
import { DEMO_LABELS } from "@/lib/dev/kitchen-sink-fixtures";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border-subtle py-6">
      <h2 className="mb-4 text-2xs font-medium tracking-wide text-text-400 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center gap-4 py-1">
      <span className="w-40 shrink-0 text-xs text-text-300">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function KitchenSinkInteractive() {
  const [removable, setRemovable] = useState(DEMO_LABELS);
  const [title, setTitle] = useState("Harden the CTF scoreboard endpoint");
  const [notes, setNotes] = useState(
    "Rate limiting is missing on the submission route.",
  );

  return (
    <>
      <Section title="Label chip">
        <Row label="static">
          {DEMO_LABELS.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </Row>
        <Row label="removable">
          {removable.map((label) => (
            <LabelChip
              key={label.id}
              label={label}
              removable
              onRemove={() =>
                setRemovable((current) =>
                  current.filter((item) => item.id !== label.id),
                )
              }
            />
          ))}
          {removable.length === 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRemovable(DEMO_LABELS)}
            >
              Reset
            </Button>
          )}
        </Row>
      </Section>

      <Section title="Inline editable text">
        <Row label="single line">
          <span className="text-base font-medium text-text-100">
            <InlineEditableText value={title} onSave={setTitle} />
          </span>
        </Row>
        <Row label="multiline">
          <span className="w-96 text-sm text-text-200">
            <InlineEditableText value={notes} onSave={setNotes} multiline />
          </span>
        </Row>
        <Row label="slow save (1s)">
          <span className="text-sm text-text-100">
            <InlineEditableText
              value={title}
              onSave={async (next) => {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                setTitle(next);
              }}
            />
          </span>
        </Row>
      </Section>

      <Section title="Interaction states">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-2xs text-text-400 uppercase">
              Sidebar item
            </p>
            <div className="w-56 rounded-md border border-border-subtle bg-bg-90 p-1">
              <div className="flex h-7 items-center rounded-sm px-2.5 text-xs text-text-200">
                Default
              </div>
              <div className="flex h-7 items-center rounded-sm bg-bg-80 px-2.5 text-xs text-text-200">
                Hover
              </div>
              <div className="flex h-7 items-center rounded-sm bg-bg-70 px-2.5 text-xs text-text-100">
                Active
              </div>
              <div className="flex h-7 items-center rounded-sm px-2.5 text-xs text-text-200 outline-1 outline-offset-2 outline-border-focus">
                Focus
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-2xs text-text-400 uppercase">List row</p>
            <div className="overflow-hidden rounded-md border border-border-subtle">
              <div className="flex h-row items-center px-3 text-sm text-text-200">
                Default
              </div>
              <div className="flex h-row items-center bg-bg-90 px-3 text-sm text-text-200">
                Hover
              </div>
              <div className="flex h-row items-center border-l-2 border-l-brand bg-bg-80 px-3 text-sm text-text-100">
                Selected
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-2xs text-text-400 uppercase">Kanban card</p>
            <div className="flex gap-3">
              <div className="w-40 rounded-md border border-border-subtle bg-bg-80 px-3 py-2.5 text-sm">
                Default
              </div>
              <div className="w-40 rounded-md border border-border-strong bg-bg-80 px-3 py-2.5 text-sm shadow-sm">
                Hover
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-2 text-2xs text-text-400 uppercase">Dragging</p>
              <div className="w-40 rotate-[1.5deg] rounded-md border border-border-strong bg-bg-80 px-3 py-2.5 text-sm opacity-90 shadow-lg">
                In flight
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-2xs text-text-400 uppercase">Buttons</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Primary</Button>
              <Button size="sm" variant="secondary">
                Secondary
              </Button>
              <Button size="sm" variant="ghost">
                Ghost
              </Button>
              <Button size="sm" variant="destructive">
                Destructive
              </Button>
              <Button size="sm" disabled>
                Disabled
              </Button>
            </div>

            <p className="mt-4 mb-2 text-2xs text-text-400 uppercase">
              Dropdown item
            </p>
            <div className="w-40 rounded-md border border-border-subtle bg-bg-80 p-1 shadow-md">
              <div className="rounded-sm px-2 py-1.5 text-sm text-text-200">
                Default
              </div>
              <div className="rounded-sm bg-bg-70 px-2 py-1.5 text-sm text-text-100">
                Hover
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
