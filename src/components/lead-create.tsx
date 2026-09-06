'use client';
import { useCRM } from './store';
import { Form, Modal, type Field } from './ui';
import { SOURCES, fullName, isLegacyFollowUpStage } from '@/lib/types';
import { matchesCustomer } from '@/lib/customer-match';
export function LeadCreate({ onClose }: { onClose: () => void }) {
  const { data, userId, mutate } = useCRM();
  const fields: Field[] = [
    { name: 'first_name', label: 'First name', required: true },
    { name: 'last_name', label: 'Last name' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'instagram', label: 'Instagram handle' },
    { name: 'location', label: 'Location' },
    {
      name: 'preferred_contact',
      label: 'Preferred contact',
      type: 'select',
      options: ['Email', 'Phone', 'SMS', 'Instagram', 'Facebook', 'WhatsApp'],
    },
    {
      name: 'source',
      label: 'Lead source',
      type: 'select',
      options: data.settings.find((s) => s.key === 'lead_sources')?.value ?? SOURCES,
      required: true,
    },
    { name: 'make', label: 'Vehicle make', required: true, placeholder: 'BMW' },
    { name: 'model', label: 'Vehicle model', required: true, placeholder: 'M4 Competition' },
    { name: 'chassis', label: 'Generation / chassis', placeholder: 'G82' },
    { name: 'year', label: 'Year', placeholder: '2024' },
    {
      name: 'stage_id',
      label: 'Pipeline stage',
      type: 'select',
      options: data.pipeline_stages
        .filter((s) => !isLegacyFollowUpStage(s.name))
        .map((s) => ({ value: s.id, label: s.name })),
      required: true,
    },
    {
      name: 'handled_by',
      label: 'Handled by',
      type: 'select',
      options: data.profiles.map((p) => ({ value: p.id, label: p.display_name })),
    },
    {
      name: 'priority',
      label: 'Priority',
      type: 'select',
      options: ['Low', 'Normal', 'High'],
      required: true,
    },
    { name: 'notes', label: 'Enquiry / notes', type: 'textarea' },
  ];
  return (
    <Modal
      title="A new connection."
      subtitle="Capture the enquiry. We’ll take it from here."
      onClose={onClose}
    >
      <Form
        fields={fields}
        initial={{
          source: 'Website',
          priority: 'Normal',
          preferred_contact: 'Email',
          stage_id: [...data.pipeline_stages].sort((a, b) => a.position - b.position)[0]?.id,
          handled_by: userId,
        }}
        onSubmit={async (values) => {
          await mutate({
            action: 'create_lead',
            values: { ...values, handled_by: values.handled_by || null },
          });
        }}
        onClose={onClose}
        submitLabel="Create lead"
        description={(values) => {
          const match = data.customers.find(
            (customer) => !customer.archived_at && matchesCustomer(customer, values),
          );
          return match
            ? `Existing customer found: ${fullName(match)}. This enquiry will be linked to their history without overwriting contact details.`
            : 'Existing customers are matched by email or phone. A new enquiry and vehicle are added to their history without overwriting their contact details.';
        }}
      />
    </Modal>
  );
}
