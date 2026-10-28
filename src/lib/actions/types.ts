export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  link?: string;
  linkLabel?: string;
  fieldErrors?: Record<string, string>;
} | null;

export const emptyActionState: ActionState = null;
