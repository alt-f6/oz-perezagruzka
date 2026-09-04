-- Student: operator-entered contact email, editable on the profile card and
-- used to seed the LMS invite. Nullable so existing rows are preserved, and
-- intentionally NOT unique: uniqueness is validated gracefully in the app
-- layer (against other students and existing User accounts) so a collision
-- surfaces as a friendly message rather than a raw constraint violation.
ALTER TABLE "Student" ADD COLUMN "email" TEXT;
