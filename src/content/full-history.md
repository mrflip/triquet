Clicking "Download Full History" delivers a single file named for the hunt and ending in `.zip`, which a computer can expand into a folder holding every part of the hunt as it stands now. That folder is also what's known as a "git repo" (more polite than it sounds): it remembers every earlier state of the hunt as well. By installing an application that works with a git repo, you can view each change, tiny and large; make copies of the hunt as it stood at selected timepoints in the past; and compare the state of one or many files between a pair of timepoints you name.

**What's in it.** Every part of the hunt is written once, named by its label, in two forms: a `.json` file holding all of it, and a `.tsv` table beside it with the same name, for reading and comparing. Every quiz sits in the realm `home`, and the `README.md` inside the folder says more.

* `hunt.tqh.json`: the hunt's own label, title and branch.
* `categories.tqc.json`: every subject category, with the slot of the wheel it holds.
* `members.tqm.json`: who is on the hunt, by their label, with their role.
* `quizzes/<realm>/<quiz>.tqq.json`: one quiz, whole: its own fields, its questions, its widgetings and its columns.
* `quizzes/<realm>/<quiz>/questions.qq.json`: the same quiz's questions alone, to paste into any quiz's Import.
* `quizzes/<realm>/<quiz>/reviews/<reviewer>.tqr.json`: one shared review of the quiz.
* `pub/widgets/<widget>.tqw.json`: a widget of the library the hunt's quizzes work.

**The whole hunt, at any timepoint.** Every `.json` file but the questions alone is a piece of the hunt, nested under the labels that lead to it, so merging them all gives the hunt whole, just as Raw Export does. With the free tool `jq` installed, this line, run inside the folder, prints the hunt as it stood at whichever timepoint the folder is set to:

```sh
jq -s 'reduce .[] as $ball ({}; . * $ball)' $(git ls-files '*.tq?.json')
```

**Relabels, branches and milestones.**

* Relabelling a quiz moves its files. git follows a file across the move: `git log --follow quizzes/home/<quiz>.tqq.json` shows the quiz's whole history, from before its relabel as well. Most git applications follow it too.
* The hunt's branch is the repo's branch. Every change is recorded on the branch the hunt's own page names, `main` to begin with. Naming a new branch there starts a new line of work from where the hunt stands; naming one used before takes it up again.
* Each milestone is a tag, named for the branch, the quiz it was marked from, and the moment, in UTC: `main_legends_m_20261005120000z`. An import or a deletion of questions leaves a tag too, with `import` or `delete` in place of the `m`.

Rather than trying to explain further, paste this text into your favorite AI Chatbot. Remove the word "don't" as appropriate for your needs:

```
I have downloaded a zip file that itself contains a git repo of a trivia hunt I'm writing: a folder of .json files, and .tsv tables beside them.
1. I don't know where that zip file is
2. I don't know how to unzip it.
3. I don't know how to install Fork (I'm told it's free and quite good)
  - I don't know if I'd instead like to try Sublime Merge (I'm told it's paid after a free trial, but possibly even better than Fork)
4. I don't know how to see one of the files at a certain time in the past. Important note: the repo has a TON of commits -- up to one every 30s. It also has tags from the times I clicked "Milestone", each named for the branch, the quiz and the moment, like main_legends_m_20261005120000z.
  - I don't know how to browse by time or tag, rather than commit
5. I don't know how to compare two versions of a file (or subtree of files)
6. I don't know how to follow a file's history across a rename (`git log --follow`)

Please offer help, starting with the first thing I don't know how to do, and only proceeding to the next when we've succeeded.
```
