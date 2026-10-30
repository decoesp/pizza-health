"use client";

import { useRef } from "react";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input, Select } from "@/components/ui/Primitives";
import { uploadDocumentAction } from "@/actions/documents";

function titleFromFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function DocumentUploadForm({
  maxLabel,
  today,
}: {
  maxLabel: string;
  today: string;
}) {
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <ActionForm action={uploadDocumentAction} className="space-y-4">
      <Field
        label="Arquivo"
        htmlFor="document-file"
        hint={`PDF, CSV, XLS, XLSX, JPG ou PNG. Até ${maxLabel}. O conteúdo é validado e fica criptografado.`}
      >
        <Input
          id="document-file"
          name="file"
          type="file"
          required
          data-testid="document-file"
          accept=".pdf,.csv,.xls,.xlsx,.jpg,.jpeg,.png"
          className="file:mr-3 file:rounded-full file:border-0 file:bg-paper-deep file:px-3 file:py-1.5 file:text-xs file:font-semibold"
          onChange={(event) => {
            const input = titleRef.current;
            if (!input || input.dataset.touched === "true") return;
            const name = event.target.files?.[0]?.name ?? "";
            input.value = name ? titleFromFileName(name) : "";
          }}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" htmlFor="document-title" hint="Aparece só para você.">
          <Input
            ref={titleRef}
            id="document-title"
            name="title"
            required
            minLength={2}
            maxLength={120}
            placeholder="ex.: Laudo completo"
            data-testid="document-title"
            onChange={(event) => {
              event.currentTarget.dataset.touched = "true";
            }}
          />
        </Field>
        <Field label="Tipo" htmlFor="document-category">
          <Select id="document-category" name="category" defaultValue="exam">
            <option value="exam">Exame / laudo</option>
            <option value="vaccine">Comprovante de vacina</option>
            <option value="other">Outro documento de saúde</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data da coleta" htmlFor="document-collected" hint="Opcional.">
          <Input
            id="document-collected"
            name="collectedOn"
            type="date"
            max={today}
          />
        </Field>
        <Field label="Laboratório / emissor" htmlFor="document-lab" hint="Opcional.">
          <Input id="document-lab" name="labName" maxLength={120} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Enviando…">Enviar documento</SubmitButton>
        <p className="text-xs text-muted">
          Sem leitura automática: você confere e confirma os dados depois.
        </p>
      </div>
    </ActionForm>
  );
}
