import assert from "node:assert/strict";
import test from "node:test";
import { checkToxicContent } from "../lib/toxic-filter.ts";

test("flags profanity, threats and personal abuse", async () => {
  for (const text of [
    "This is a fucking scam!",
    "kill yourself",
    "you are an idiot",
    "ur a loser",
    "send nudes",
    "bullshit",
    "this is bullshit",
    "what a load of horseshit",
    "f u c k",
    "i hate you",
    "I HATE YOU",
    "shut up",
    "screw you",
    "i dont like you",
    "I don't like you",
    "i really dont like you guys",
    "i dislike you",
    "we do not like you",
    "redbull bullshit",
    "fk man i wanted to ask",
    "fxk u",
    "wtf is this",
    "stfu",
    "sh1t",
    "f*ck this",
    "FUUUUCK",
    "you are a f.u.c.k",
  ]) {
    const result = await checkToxicContent(text);
    assert.equal(result.isToxic, true, `expected "${text}" to be flagged`);
    assert.match(result.reason ?? "", /inappropriate|toxic/i);
  }
});

// The portal exists so students can ask employers hard questions. A filter that
// eats criticism trains students not to ask, which costs more than it saves.
test("lets blunt but legitimate questions through", async () => {
  for (const text of [
    "What are the minimum qualifications required for this software engineer position?",
    "Is this a scam? The salary seems too high for an intern role.",
    "I don't like the hours, is the schedule negotiable?",
    "I dont like the location, is remote possible?",
    "I don't really like night shifts — are there day roles?",
    "Honestly the application process is stupid and slow, can it be simplified?",
    "Why is your training programme rated worst among the big four?",
    "I hate the commute to KL, is remote work possible?",
    "Do you assess candidates by class rank or CGPA?",
    "Is the Shiitake catering halal certified?",
    "What analysis tools does the team use?",
    "Is the coarse aggregate supplier local?",
    "Do folk from other campuses attend?",
    "What is the assessment split for the BS in Computing?",
    "Can I ask about the shift roster?",
    "Do you recycle your trash on site?",
    "It's easy to get lost — where is Hall A?",
  ]) {
    const result = await checkToxicContent(text);
    assert.equal(result.isToxic, false, `expected "${text}" to pass`);
  }
});

test("empty input is not toxic", async () => {
  assert.equal((await checkToxicContent("   ")).isToxic, false);
});
