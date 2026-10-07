/sprint recap
YOLO MODE!!!

Look in whiteboard/20261005-recap/20261005-recap_bbjank.md. The LLeague has yet a different (quiz league export, smith's note export) bbcode format, this one is for the message boards.

thread:
Add the ability to nominate a field to be templated with handlebars (or other npm for mustacha). It gets basically what the expressions do, { hunt, realm, categories, quiz, questions } -- take your best guess. Users are with this enabled to add images, etc. Don't go nuts, right now all we need is to substitute in custom columns. We are not letting people write html code: just basic clean markdown. err on the side of strictness.
Make sure our sanitization is on lock. Sanitizer Must Always Go Last: Do not try to sanitize the variables before putting them into Mustache, or sanitize the text before running the markdown parser.

thread:
Look in 20261005-recap_bbjank
Do your best to make a markdown -> bbjank converter. Do not be a hero: if sometthing is hard, write it to TODO and let me know. Do not bang rocks together, much: the md-AST tool should cover this; I highlighted where a regex might be, and you might find a couple similar regexes needed, but don't decide "ok ast  isn't working I'll just write my own parser"

thread: sprint runner -- prediict what fields you'll add (recap head, recap  tail, recap field on question, others?); have the worker write the widening expression.
(sprint runner -- at the end, rewrite history in the sprint to give a clean widen-seed-tighten series of prs. note that vercel now runs migrations as a matter of course, but stiill inform coach in the progress and final summary)
Follow the rules for PR titles of widening prs.

thread: add another export doodad! this one is going to add a panel at the bottom for creating a recap note. It will have a recap_head and recap_tail -- both similar to the smith's note. in between is a five-line or so scrollable concatenation of the bbjank rendered head, the tail individual questions and their recap fields, as shown below.

thread: add quiz expressions and entries; I can (in the quiz gearbox) define columns on the *quiz*, and custom entries (no other widgets next, unless it's easy).
those actual entries, and their columns, will appear in a new panel.

In the quiz widgetings editor, just like in the questions one, I can drag the order of widgetings: each one gets everything calculated before it. One of them is special: the questions widgeting: calculate quiz widgetings up to that, then calculate question widgetings, then the rest of the quiz widgetings.

thread: all panels have collapse triangles (turning them small), and (similar to the radar plot) expand arrow (making them bix). Don't overinvest in making this good or pretty

thread: Do a strong security review. Fix anything that's part of the sprint, make a note in the final report AND in the todo of other things to fix. At the end of the sprint, fix what you're certain of.


Sprint runner: you may choose to do a pass of basic implementation and then a pass of workers to fancify it.
REMEMBER: this may appear to be a spec for a grand, general, quiz authoring tool.
HOWEVER: What I need by the end of this sprint is an export of simple markdown into bbjank; I can copy paste whatever

---

In the below, let's not pretend that I know mustache; go with what you think I meant, especially when I'm referring to things we haven't implemented

```
First, a huge thank you to the playtesters:
{{quiz.reviewers_body}}
And congratulations to the winners: {{quiz.winners_body}}

{{recap_head}}

{{each question }}
> {AS: Q1}{{question.body || question.clueing}}
{{/each}}


// .... and so on:

{{recap_tail}}
```

would then in bbjank be something like the following.

```
First, a huge thank you to the playtesters:
@bob
...
And congratulations to the winners: @frank, ...

{{recap_head}}
-------------------------------------------

[quote="Q1"]1. The four science YouTubers arrayed in the image below are paying homage to a notable Irish physicist, whose character later raps "And no one uses my quaternions, But just you wait, just you wait". [b]What's his name, man?[/b]
[list]    ...BUT NOT... [/list]
[list]the progenitors in "Viable offspring derived from fetal and adult mammalian cells" (Wilmut, Schnieke et al., Nature 1997 Feb 27;385(6619):810-3) [url=https://learnedleague.com/images/art/7998/7998_1_893016.png]Click here[/url]
[/list][/quote]

Answer: [spoiler][b](WILLIAM ROWAN / LEWIS) HAMILTON[/b][/spoiler]
Correct Answer %:
{Add Optional Text For Q1 Here or Delete}

[quote="Q2"]2. [b]What name[/b] will be borne by CVN-80, the third of the Gerald R. Ford-class aircraft carriers? That storied name is also contemplated for a future vessel with hull number NCC-1701...    ...BUT NOT...    Tubbs' Ferrari-driving vice-squad partner[/quote]Answer: [spoiler][b]ENTERPRISE (USS ENTERPRISE, CVN-80 / ENTERPRISE RENT-A-CAR)[/b][/spoiler]
Correct Answer %: 76
{Add Optional Text For Q2 Here or Delete}

// .... and so on:

{{recap_tail}}
```

NOTE WITH CAUTION: I'm writing a spec for a grand, general, quiz authoring tool.
HOWEVER: What I need by the end of this sprint is an export of simple markdown into bbjank.