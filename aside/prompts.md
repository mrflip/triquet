I envision the puzzle editor as being modular for different puzzles

At the basic level, we have a quiz, with questions, having "Q#", "label", "question", "answer".

Other things come in as widgets that do complicated things, or expressions if it's just post-processing.

We are **not** implementing some sort of module facility where we need to be thinking about generic data model and whatnot for these. This is more about strict separation of concerns and a way to manage what I see on the screen for various lifecycle phases of editing a quiz


## Expressions

Add JSONata.
Allow a quiz to have many expressions.

