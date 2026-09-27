# Future Models

These are imperfectly conceived names for the eventual access model:

* an **ident** is a persona in the app: claudeathome, claudeatwork.
* A cred is a credential from a reliant provider (Eg google apps);
  - a creding associates a cred with an ident (claude@gmail <-> claudeatwork)
  - you may assume any ident associated with your current cred
  - a user has exactly one active ident, identing, and cred while using the app
* A hunt has many realms, which have many quizzes. In our first delivery,
  - When a hunt is created, it generates a unique label; that is then titleized to its initial title
  - a single realm labelled 'home' is created; it also follows the "if I have no titile, titleize my label" logic. There's no ability yet to add or delete a realm.
  - a single quiz, with the same label (and thus title)
* A hunting associates  an ident with a hunt, granting a role:
  - roles may include smiths, reviewers and players
    (the current "players" model will be at some point renamed "bots" or something).
    A smith can access anything within a hunt; reviewers have only certain views on the data,
    and players an overlapping but different set of views.


I would like to:

1. rename 'player/playing' etc to bot / botting
2. add the ident model, with title and label. Any visitor can assume any ident. The label must be between six and twenty-four letters long inclusive.
3. Implement the concept of a hunt and a puzzle, mostly so that we can stabilize urls and label scopes. the creator of a hunt acquires the smith role. Any smith can add an ident as a smith or reviewer.
4. add a stub reviewing view -- for the moment, just list the questions and a feedback entry field.
5. Visiting `/` lets you enter an ident label, at which point you become that ident if it exists or else creates an ident with that label and title. Record the ident in the traditional way
   - when "logged in", `/` redirects to  `/my/hunts`, which gives a list of hunts you are a member of, noting your role on each
6. I alluded to a url earlier that had review/:quiz_label; I've changed my mind on that. If you agree it's a good approach, let's have urls identify resources and use query parameters to specify presentations -- /h/:hunt_label/:realm_label/:quiz_label?act=smith (or act=review). if the act param is absent, redirect to smith if a smith, or review if a reviewer.
   - old links will break, we will not try to revive them. same with existing quizzes

write a plan I can hand to Opus to implement. Add in details that you're reasonably confident in, and check with me where you're not. Identify concerns or questions you have.

Evaluate whether the idea of a 'workspace' still has relevance.

(I am writing this program while also using it to author a quiz I'll be giving in one week, and I want to get a couple more playtesters to review it. So we're trying to stub out enough that they can do so without stepping on my toes. The only people who will be using the app are these friends)
