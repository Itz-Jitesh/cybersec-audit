import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface InviteEmailProps {
  inviterName: string;
  workspaceName: string;
  roleLabel: string;
  teamName: string | null;
  acceptUrl: string;
  expiresLabel: string;
}

/**
 * The invite email.
 *
 * Deliberately plain: this is the one message the app sends, it goes to
 * students on phones, and every styling rule an email client might drop would
 * be one more way for the link to become invisible. Colours are literal here
 * because email has no CSS variables — the no-hex rule covers `src/components`
 * and `src/app`, which this file is outside of for exactly that reason.
 */
export function InviteEmail({
  inviterName,
  workspaceName,
  roleLabel,
  teamName,
  acceptUrl,
  expiresLabel,
}: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${inviterName} invited you to ${workspaceName}`}</Preview>
      <Body
        style={{
          backgroundColor: "#f5f5f5",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: "8px",
            margin: "0 auto",
            maxWidth: "480px",
            padding: "32px",
          }}
        >
          <Heading
            style={{ color: "#111111", fontSize: "18px", margin: "0 0 12px" }}
          >
            You have been invited to {workspaceName}
          </Heading>

          <Text style={{ color: "#444444", fontSize: "14px", margin: "0 0 8px" }}>
            {inviterName} has invited you to join as <strong>{roleLabel}</strong>
            {teamName ? (
              <>
                {" "}
                on the <strong>{teamName}</strong> team
              </>
            ) : null}
            .
          </Text>

          <Text style={{ color: "#444444", fontSize: "14px", margin: "0 0 20px" }}>
            Sign in with the Google or GitHub account that received this email.
            The invite is what lets you in, so use this address and no other.
          </Text>

          <Button
            href={acceptUrl}
            style={{
              backgroundColor: "#3f76ff",
              borderRadius: "6px",
              color: "#ffffff",
              display: "inline-block",
              fontSize: "14px",
              fontWeight: 500,
              padding: "10px 18px",
              textDecoration: "none",
            }}
          >
            Accept the invite
          </Button>

          <Text style={{ color: "#888888", fontSize: "12px", margin: "20px 0 0" }}>
            This link expires {expiresLabel}. If you were not expecting it, you
            can ignore this email.
          </Text>
          <Text style={{ color: "#888888", fontSize: "12px", margin: "8px 0 0" }}>
            {acceptUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
