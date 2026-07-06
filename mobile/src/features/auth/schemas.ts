import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const emailSignupSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type EmailSignupFormValues = z.infer<typeof emailSignupSchema>;
