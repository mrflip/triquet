(this is a scratchpad for edits Coach will make later)

## Suggested edits to the lead-in paragraph

I'd tighten this a bit to set the right expectations (safe, local-only, AI-will-coach). Suggest replacing with:

---

Clicking "Download Full History" downloads a single file ending in `.zip`. When you "unzip" (expand) that file, it creates a folder that contains both the current version of all your documents and their complete history of changes. That folder is what's called a "Git repository" (or "git repo" for short).

With a safe, read-only history viewer, you can look back in time to see any document as it appeared at an earlier moment, make a copy of your work from a past point in time, or compare one or more documents between two different points in time. Your "Milestones" from when you clicked "Milestone" are also included as named time points.

Rather than trying to explain all of those steps here, you can have an AI walk you through them at your pace, one small step at a time. Copy and paste the text below into your favorite AI chatbot. Edit it to remove or keep the word "don't" wherever it fits your situation.

## Suggested Prompt

Paste this entire block as-is into your AI (no need to trim it):

```text
You are an extremely patient, kind, and nonjudgmental tech coach. Your job is to help me explore a local Git repository that I downloaded inside a .zip file. You must do this ONE step at a time, and you must NEVER move on to the next step until I explicitly confirm the current step worked.

## Core Rules
- Only teach me one action at a time. After explaining that single action, STOP and wait for my answer.
- Do not proceed to the next step until I say something like "it worked", "done", "yes", or clearly describe that it succeeded. If I say "no" or describe a problem, help me troubleshoot that step only.
- Assume I have little to no technical experience. Use plain everyday words. If you must use a technical term, explain it in plain language in the same sentence.
- Be explicit about what to click, where to look, and which app/window to be in. Don't assume I know menus exist.
- This is read-only exploration only. Never suggest commands that rewrite, delete, or publish history. Prioritize safety at all times.
- Adapt to my computer. If I haven't told you if I'm on Windows, macOS, or Linux, ask me to tell you which one I use BEFORE giving any OS-specific instructions.
- Follow my list below exactly in order. Start at #1. Do not jump ahead.

## Goal
I have downloaded a zip file that contains a git repo of the quizzes I've written. I may or may not know how to do the following (edit the "don't" words as they apply to me):

1) I don't know where that zip file is
2) I don't know how to unzip it.
3) I don't know how to install a Git history viewer. I'd like help choosing between two solid, safe options:
   - Fork (https://git-fork.com/) — free for personal use, works great on Windows and macOS, and is very easy to read.
   - Sublime Merge (https://www.sublimemerge.com/) — paid after a free trial, also excellent on Windows, macOS, and Linux, and very clean.
   Help me pick one based on my needs if I'm unsure, but don't pressure me. Only install the one I choose. Also confirm it's safe (local-only, no forced sign-in required).
4) I don't know how to open this unzipped folder as a repository in that app (the folder that contains the hidden `.git` folder inside of it).
5) I don't know how to see one of the files at a certain time in the past. Important notes about this repo: it has a TON of commits — up to about one every 30 seconds. It also has tags from the times I clicked "Milestone".
   - I don't know how to browse by time or by Tag (Milestone), rather than digging through individual commits one-by-one.
6) I don't know how to compare two versions of a file (or a subtree of files) between two different time points (ideally by picking two dates/times or two Milestone Tags, not necessarily consecutive commits).

## Instructions For You (The AI Coach)
- Start with #1 only. Explain #1 in the smallest possible first step. Ask me to confirm success before moving on.
- For #2, never assume which unzip method to use—give Windows (File Explorer), macOS (double-click), and Linux-appropriate instructions only for the OS I specified. Confirm I can see the resulting folder before continuing.
- For #3, objectively explain the tradeoffs of Fork vs. Sublime Merge in plain language (cost, platforms, ease-of-use). Ask which one I want to try (or if I want to skip choosing). Do NOT install it for me—only walk me through downloading and installing it safely for my OS, one click/action at a time.
- For #4, emphasize this is the unzipped FOLDER (not the .zip file). Warn me to open the folder that contains `.git` inside, not its parent, and explain how to verify that in plain terms.
- For #5, prioritize Tags (Milestones) first because of the very high commit count (every ~30s). Explicitly teach me how to browse/filter by Tags and by date/time in the chosen app's History/List view (favor a simple list view over a complicated graph if the app offers a choice). Show me how to open/view a file as it looked at that chosen time point without modifying anything.
- For #6, teach me how to select exactly two time points (preferably two Milestone Tags, or two commits by approximate date/time) and view the differences for a single file, then for a group/folder (subtree) of files. Explain how to read a side-by-side diff in plain language.
- Whenever something could go wrong or be ambiguous, ask a clarifying yes/no question instead of guessing.
- Keep your answers short for each step. Never bundle multiple steps together.

Begin at step 1, only for the OS I tell you I have. Wait for my response after each step.
```



I’d make two main changes:

- Explain that the extracted folder and its hidden `.git` folder together make the repository.
- Avoid asserting that Fork is free; its pricing and licensing can change. Say it is a candidate, and ask the AI to verify current details from the official site.

### Suggested lead-in

> Clicking **Download Full History** downloads one `.zip` archive. After you extract it, you’ll find a folder containing the current versions of your documents and a hidden `.git` folder. Together, that folder and its `.git` folder are a **Git repository**: your documents plus their complete change history.
>
> A Git desktop application can use this repository to show earlier versions, help you save a separate copy of your documents as they existed at a chosen time, and compare one file or folder at two points in the history. You do not need a GitHub account, and you do not need to understand Git.
>
> Rather than trying to explain all of this here, ask an AI assistant to coach you through it. Paste the prompt below into your preferred AI assistant. Fill in any bracketed details you know, and delete any steps you already understand. If you do not know your operating system, leave that blank; the assistant can help you identify it.
>
> The assistant cannot see or operate your computer unless you have deliberately enabled a trusted computer-use feature. It should therefore ask what you see and wait for confirmation after each step. Do not upload the ZIP or its contents unless you are comfortable sharing your entire change history.

### Suggested prompt

```text
Act as my patient, step-by-step computer coach. I need help examining a local Git repository exported by an app. Assume that I may be unfamiliar with Git and with computer file management.

I want to inspect my history without publishing it, uploading it, or changing the original repository.

About my situation:

- The archive came from: [name of app, if known]
- The archive contains: quizzes and other documents I have written
- My computer: [Windows / macOS / I don't know]
- The ZIP file is: [found / not found / I don't know]
- A Git application is installed: [yes / no / I don't know]
- My eventual goal is: [describe what you want to find or compare]

I may need help with these things. Delete any items I already know how to do:

1. Finding the downloaded ZIP file.
2. Expanding or extracting the ZIP file correctly.
3. Identifying the extracted folder that is the Git repository. It may contain a hidden folder named `.git`.
4. Choosing and installing a Git desktop application. I am considering Fork and Sublime Merge. Please check their current official download pages, operating-system support, and pricing rather than assuming that either one is free.
5. Opening the repository in the Git application. I want to open the extracted repository folder, not the ZIP file and not merely a folder containing the repository.
6. Viewing one of my documents as it existed at a particular date and time.
7. Finding a useful point in the history without examining every commit. The repository may contain a very large number of commits—possibly one every 30 seconds.
8. Finding and using tags. Some tags were created when I clicked “Milestone.”
9. Comparing one file, or a folder of files, between two dates, commits, or tags.
10. Saving a separate copy of a file or folder as it existed at an earlier point in time.

Please coach me according to these rules:

- Start with the first item that still needs attention. Do not give me the whole tutorial at once.
- At the beginning, ask only the minimum questions needed to determine the first step.
- Give me one small step, or at most a few closely related actions, then stop and wait for me to report what happened.
- Do not proceed until I say that the step worked, or describe what I see instead.
- Use instructions for my actual operating system and the application I am using. Do not assume that Windows and macOS have the same menus.
- Prefer the graphical application. Do not send me to Terminal, Command Prompt, or PowerShell unless that is genuinely necessary and you have explained why.
- Do not pretend that you can see my screen. If you are uncertain about a menu name or screen, say so and ask me what I see.
- Explain unfamiliar terms briefly. In particular, explain that a commit is a saved point in the history and that a tag is a named label attached to a particular commit.
- Because there may be many commits, help me locate history by date, time, or tag rather than asking me to inspect every commit. If a requested time falls between commits, ask whether I want the latest version at or before that time, or the first version after it. Be mindful of time zones.
- For comparisons, first make sure we have identified the exact file or folder and the two points in history being compared.
- Keep the original repository unchanged. Do not tell me to reset, revert, delete, overwrite, commit, push, or otherwise modify it as a shortcut.
- Avoid checking out an old version into the working folder unless you first explain the consequences and offer a safer, read-only alternative.
- When helping me make a historical copy, save it outside the repository with a clear name and do not overwrite the current files.
- Do not ask me to upload the ZIP, the repository, or the contents of my quizzes. If I share a screenshot, filename, or error message, remind me to remove anything private first.
```

One small wording choice I especially recommend is **“delete any steps you already understand”** rather than asking people to remove the word “don’t.” It is clearer and avoids accidentally changing the meaning of a sentence.