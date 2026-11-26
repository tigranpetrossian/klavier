'use client';

import { TunableRow } from './tunable-rows';
import { SECTIONS, type RowSpec, type SectionSpec } from './tunable-sections';
import { Panel, Section } from '@/lib/tuner/ui';

export function TunerPanel() {
  return (
    <Panel.Root>
      <Panel.Trigger />
      <Panel.Drawer>
        <Panel.Header>
          <Panel.Title>Tuner</Panel.Title>
          <Panel.Undo />
          <Panel.Redo />
          <Panel.Close />
        </Panel.Header>
        <Panel.Body>
          {SECTIONS.map((section, index) => (
            <TunableSection key={index} section={section} />
          ))}
        </Panel.Body>
        <Panel.Footer>
          <Panel.Reset />
          <Panel.Save />
        </Panel.Footer>
      </Panel.Drawer>
    </Panel.Root>
  );
}

function TunableSection({ section }: { section: SectionSpec }) {
  return (
    <Section.Root collapsible defaultOpen={section.open}>
      <Section.Header>
        <Section.Trigger>
          <Section.Title>{section.title}</Section.Title>
        </Section.Trigger>
      </Section.Header>
      <Section.Body>
        {section.rows.map((row) => (
          <TunableRow key={rowKey(row)} spec={row} />
        ))}
      </Section.Body>
    </Section.Root>
  );
}

function rowKey(row: RowSpec): string {
  return row.kind === 'constant' ? row.id : row.name;
}
