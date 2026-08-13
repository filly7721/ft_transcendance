import type { Metadata } from "next";
import LegalDoc from "@/components/legal/LegalDoc";
import Section from "@/components/legal/Section";

export const metadata: Metadata = {
  title: "Terms of Service — ARCADE",
  description:
    "The rules for playing on ARCADE: accounts, fair play, chat conduct, and what the project does and does not promise.",
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="TERMS OF SERVICE"
      updated="13 August 2026"
      other={{ href: "/privacy", label: "Privacy Policy" }}
      summary={
        <>
          Play fair, be decent to the other player, and do not attack the
          server. In exchange you get two games, a friends list and a chat —
          with no promises about uptime, because this is a student project and
          the database may be wiped at any time.
        </>
      }
    >
      <Section n={1} title="Agreeing to these terms">
        <p>
          Creating an account means you accept these terms. If you do not, do
          not register — you can still read this page and the{" "}
          <strong>Privacy Policy</strong> without an account.
        </p>
      </Section>

      <Section n={2} title="What ARCADE is">
        <p>
          ARCADE is a web application built by a team of students for the{" "}
          <strong>ft_transcendence</strong> project of the 42 curriculum. It
          offers two real-time games — Minesweeper Versus and Super
          Tic-Tac-Toe — plus profiles, friends, direct messaging, and a public
          API.
        </p>
        <p>
          It is coursework, not a product. It is free, it carries no
          advertising, nothing is for sale, and no money changes hands in any
          direction.
        </p>
      </Section>

      <Section n={3} title="Your account">
        <p>
          You need an email address, a login and a password to play. Register
          one account for yourself and keep your password to yourself: anything
          done through your account is treated as done by you.
        </p>
        <p>
          Pick a login and display name that are not offensive, and that do not
          impersonate another player, a member of staff, or the ARCADE team
          itself.
        </p>
      </Section>

      <Section n={4} title="How to behave">
        <p>Do not use ARCADE to:</p>
        <ul>
          <li>
            harass, threaten, or abuse another player, in chat, in a display
            name, or in an avatar;
          </li>
          <li>
            post content that is illegal, hateful, sexual, or that you have no
            right to share;
          </li>
          <li>
            send unsolicited bulk messages, or repeatedly message someone who
            has removed you as a friend;
          </li>
          <li>impersonate anyone, or claim an association you do not have.</li>
        </ul>
        <p>
          If someone is bothering you, block them from your friends list.
          Blocking ends the friendship, stops messages in both directions, and
          hides each of you from the other&apos;s lobby browser so you will not
          be matched again. They are not told, and you can lift it at any time.
          Unfriending alone is weaker — it stops messages, but they can send a
          fresh request.
        </p>
      </Section>

      <Section n={5} title="Fair play">
        <p>
          Every move is validated on the server, and the server decides the
          outcome. Both Minesweeper boards in a match are identical and
          generated to be solvable without guessing, and your opponent’s board
          is fogged so you cannot read answers off it.
        </p>
        <p>Do not try to get around any of that. Specifically, do not:</p>
        <ul>
          <li>
            automate play with a bot, script, or any tool that plays for you;
          </li>
          <li>
            send crafted or replayed WebSocket messages to make moves the
            interface would not allow;
          </li>
          <li>
            share a room code to bring a third party into a match, or play both
            seats yourself to farm results;
          </li>
          <li>exploit a bug instead of reporting it.</li>
        </ul>
        <p>
          Leaving a match in progress does not forfeit it. Your seat is held for
          you and reconnecting puts you back in it, with your opponent shown a
          disconnected marker in the meantime. If both players leave, the room
          is discarded after a short wait and no result is recorded for either
          of you.
        </p>
      </Section>

      <Section n={6} title="Do not attack the service">
        <p>
          No denial-of-service, no brute-forcing logins or room codes, no
          scraping, no attempt to bypass rate limits by rotating addresses or
          keys, and no probing for vulnerabilities in someone else’s data.
        </p>
        <p>
          Finding a security flaw and telling the team about it privately is
          welcome and is not a breach of these terms. Exploiting it is.
        </p>
      </Section>

      <Section n={7} title="Content you post">
        <p>
          Your messages, display name and avatar remain yours. You are
          responsible for them, and you confirm you have the right to upload
          what you upload. Avatars must be a PNG, JPEG or WebP image under 2 MB.
        </p>
        <p>
          We do not review content in advance, but we may remove anything that
          breaks section 4 — and we grant ourselves no other licence over what
          you post. Delete your account and it goes with you (see the{" "}
          <strong>Privacy Policy</strong>, section 9).
        </p>
      </Section>

      <Section n={8} title="The public API">
        <p>
          This section only concerns you if you write code against ARCADE — if
          you are here to play, you will never need a key and can skip it. The{" "}
          <code>/api/v1</code> endpoints are authenticated by an API key, which
          you generate in <strong>Settings</strong>. A key acts as you and can
          do only what you can do, so treat it like a password: anything done
          with your key is your responsibility. It is shown once, at creation,
          and cannot be recovered afterwards.
        </p>
        <p>
          Calls are limited to 100 per minute per key, and you may hold one key
          at a time — revoke the current one from Settings to issue a
          replacement. Do not share keys, and revoke any key you no longer need.
          We may revoke a key that is being used to abuse the service.
        </p>
      </Section>

      <Section n={9} title="No uptime, no warranty">
        <p>
          ARCADE is provided <strong>as is</strong>. There is no service level,
          no support commitment and no guarantee that it works, stays available,
          or keeps your data. The server may go down, be redeployed, or have its
          database reset between evaluation sessions — which permanently deletes
          every account, match record and message on it.
        </p>
        <p>
          There are no backups. Do not store anything here you would be upset to
          lose, and do not use ARCADE chat for anything sensitive.
        </p>
      </Section>

      <Section n={10} title="Ending it">
        <p>
          You can delete your account at any time from Settings; the deletion is
          immediate and permanent. We may suspend or remove an account that
          breaks these terms, and may do so without warning where the behaviour
          is harming other players or the server.
        </p>
      </Section>

      <Section n={11} title="Liability">
        <p>
          To the extent the law allows, the team behind ARCADE is not liable for
          any loss arising from your use of it — including lost accounts, lost
          match history, lost messages, or downtime. This is a student project
          offered free of charge, and it is used at your own risk.
        </p>
      </Section>

      <Section n={12} title="Changes to these terms">
        <p>
          These terms may change as the project does. The date at the top of
          this page shows when they last did. Continuing to play after a change
          means you accept the new version.
        </p>
      </Section>

      <Section n={13} title="Questions">
        <p>
          Ask the team. As a 42 project, the maintainers are reachable through
          the repository this application is published from, or in person at the
          campus.
        </p>
      </Section>
    </LegalDoc>
  );
}
