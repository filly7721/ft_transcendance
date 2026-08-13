import type { Metadata } from "next";
import LegalDoc from "@/components/legal/LegalDoc";
import Section from "@/components/legal/Section";

export const metadata: Metadata = {
  title: "Privacy Policy — ARCADE",
  description:
    "What ARCADE collects, why, who can see it, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="PRIVACY POLICY"
      updated="13 August 2026"
      other={{ href: "/terms", label: "Terms of Service" }}
      summary={
        <>
          ARCADE keeps the minimum it needs to run an account, a friends list
          and a game of Minesweeper. There are no analytics, no advertising and
          no third parties — nothing you do here is measured or sold. You can
          delete everything from Settings at any time, and it is gone for good.
        </>
      }
    >
      <Section n={1} title="Who runs ARCADE">
        <p>
          ARCADE is a student project built by a team of learners for the{" "}
          <strong>ft_transcendence</strong> assignment of the 42 curriculum. It
          exists to be played, demonstrated and graded. It is not a commercial
          service and there is no company behind it.
        </p>
        <p>
          The team runs the server, holds the database and is the only party
          with access to it.
        </p>
      </Section>

      <Section n={2} title="What we collect">
        <p>Everything below is data you hand us by using the site.</p>
        <ul>
          <li>
            <strong>Your account.</strong> Email address, login, display name,
            an optional avatar image, and the date you signed up. Your password
            is never stored — only a bcrypt hash of it.
          </li>
          <li>
            <strong>Games you play.</strong> Which lobbies you join, and the
            result of each finished match: the game, whether you won, lost or
            drew, an optional score, and when it was played.
          </li>
          <li>
            <strong>Your friends, and anyone you block.</strong> Who you sent a
            friend request to, who sent one to you, and whether that request is
            pending, accepted, or a block. Rejecting a request or unfriending
            someone deletes the record rather than marking it; blocking someone
            keeps a record until you lift it. Blocks are private — the other
            person is never told, and nothing in the interface reveals who has
            blocked whom.
          </li>
          <li>
            <strong>Your messages.</strong> The text of direct messages you
            send, who they were sent to, and when they were read.
          </li>
          <li>
            <strong>API keys.</strong> ARCADE has a public API for scripts,
            authenticated by a key rather than a login. You only have one if you
            deliberately created it in <strong>Settings</strong>, and you can
            hold at most one at a time. For it we store the label you gave it, a
            SHA-256 hash of the key, its first few characters so you can
            recognise it, and when it was last used. The key itself is shown
            once, at creation, and never stored — we cannot show it to you
            again, and neither can anyone who reads the database.
          </li>
        </ul>
      </Section>

      <Section n={3} title="What is held only in memory">
        <p>
          Two things are tracked while the server runs and are never written to
          the database:
        </p>
        <ul>
          <li>
            <strong>Online status.</strong> Whether you currently have a live
            connection. When your last tab closes, the record disappears — no
            history of when you were online is kept.
          </li>
          <li>
            <strong>Rate-limit counters.</strong> To stop abuse, we count
            recent requests against your IP address and against each API key.
            These counters expire within a minute and are not stored.
          </li>
        </ul>
        <p>
          The server also writes operational logs to its console — connections,
          errors, and the room codes of games that started or ended. These exist
          for debugging and are not surfaced anywhere in the application.
        </p>
      </Section>

      <Section n={4} title="What we never collect">
        <p>
          No analytics or telemetry. No advertising or tracking cookies. No
          third-party scripts of any kind. No payment details, no phone number,
          no real name, no location, no address book. We never send you email —
          there is no mailing list and no password-reset mail, because the
          feature does not exist.
        </p>
        <p>
          Your session token is kept in your browser’s <code>localStorage</code>
          , not in a cookie, and is only ever sent to the ARCADE backend.
        </p>
      </Section>

      <Section n={5} title="Why we use it">
        <p>
          Each piece of data has one job. Your email and password hash sign you
          in. Your login, display name and avatar identify you to other players.
          Friendships decide who can message you. Messages get delivered.
          Match results add up into the win/loss/draw counts on your profile.
          Rate-limit counters keep one person from flooding the server.
        </p>
        <p>
          We do not profile you, and nothing here feeds an automated decision
          about you.
        </p>
      </Section>

      <Section n={6} title="What other players can see">
        <p>
          <strong>Public to any signed-in player:</strong> your login, display
          name, avatar, the date you joined, your games-played, wins, losses and
          draws, and whether you are online right now.
        </p>
        <p>
          <strong>Private to you:</strong> your email address, your password,
          and your API keys. No endpoint returns any of these for another user.
        </p>
        <p>
          <strong>Between two people:</strong> direct messages are visible to
          the sender and the recipient, and to nobody else through the
          interface. They are stored unencrypted in the database, so the team
          running the server could read them if they opened the database
          directly — do not use ARCADE chat for anything sensitive.
        </p>
      </Section>

      <Section n={7} title="How it is kept">
        <p>
          Passwords are hashed with bcrypt and salted, so a copy of the database
          does not reveal them. API keys are stored as SHA-256 hashes for the
          same reason. Sign-in tokens expire seven days after they are issued.
        </p>
        <p>
          <strong>Avatars are public files.</strong> An uploaded avatar is
          written to the server’s disk and served without any sign-in check, the
          same way a social-media profile picture is — anyone who knows or
          guesses the file’s address can view it. Do not upload an image you
          would not want seen outside ARCADE.
        </p>
        <p>
          Traffic between your browser and the server is encrypted with HTTPS,
          including the WebSocket connections that carry live games and chat.
          The database is a single file on the server the team controls; it is
          not shared with any hosting or analytics provider.
        </p>
      </Section>

      <Section n={8} title="We do not share anything">
        <p>
          Your data is not sold, rented, traded, or handed to any third party.
          There are no processors, no partners and no integrations. It stays on
          the ARCADE server.
        </p>
      </Section>

      <Section n={9} title="Deleting your account">
        <p>
          Go to <strong>Settings → Delete account</strong> and confirm with your
          password. Deletion is immediate and permanent. It removes your account
          row and everything attached to it: your lobbies and lobby
          memberships, your friendships and pending requests, your match
          results, your API keys, and your messages.
        </p>
        <p>
          Two consequences worth knowing before you press it. Messages you sent
          to other players are deleted too, so they will vanish from the other
          person’s conversation as well. And because deletion is permanent,
          there is no recovery and no grace period — we keep no backup copy of
          your account to restore from.
        </p>
        <p>
          You can also change your login, display name and avatar at any time
          from Settings, and revoke an API key without deleting your account.
        </p>
      </Section>

      <Section n={10} title="Data may be wiped for evaluation">
        <p>
          ARCADE is coursework. The database may be reset between demonstrations
          or evaluation sessions, which deletes every account without notice.
          Treat anything you create here as temporary.
        </p>
      </Section>

      <Section n={11} title="Changes to this policy">
        <p>
          If what we collect changes, this page changes with it and the date at
          the top moves. The project is small enough that the honest summary is:
          if a new feature stores something new, it will be listed in section 2.
        </p>
      </Section>

      <Section n={12} title="Questions">
        <p>
          Ask the team. As a 42 project, the maintainers are reachable through
          the repository this application is published from, or in person at the
          campus.
        </p>
      </Section>
    </LegalDoc>
  );
}
