/** Какво връща една server action към формата си. */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /** Въведеното от потребителя – връща се, за да не се изтрие при грешка. */
  values?: Record<string, string>;
};

export const emptyFormState: FormState = {};
