## The bbjank verifier

Paste the bbjank beside this file into a board's preview: each section says what it should show.

## Spoilers

~~Bruce Willis is dead {AS: Hi I am the spoiler animation}~~
~~The annotation isn't required~~
About ~50 years ago, ~~**~50 YEARS**~~: a single tilde is a tilde.
~~shh {AS: a]b "c"}~~ has its annotation's bracket and quotes softened.

## Quotes

> {AS: bob}Hi, I'm bob

> {AS: bob}
> The name may stand on a line of its own.

> A quote naming nobody indents, with the tag on the same line as the text.
> > A quote within it indents twice.

You indent with spaces:
    four spaces are a quote level
        eight are two
      six spaces are one level, the two left over not rescued
back out, with no blank line.

## Lists

* bulleted
* main bullet with sub bullets
  * level two A
  * level two B
* bulleted to the left level one

1. Point one
2. Second Point,
   continued
   > {AS: fleas}Adam
   > Had 'em
3. Third point

A text may open with a year:

1984. Orwell's year opens a list at 1984: the board shows 1, the tag says what it was.

1984\. Escaped, it is only a year.

## Code

`wwww iii lll 111 iii lll 111 - - -`

```
ssuuuup
    code, its indent its own
> and its markdown **too**
```

## Emphasis

Text may be __underlined to underscore__, _italicized for extraness_, *italicized again*, or **bolded for boldness**.
It *does understand **nested** text, __and
it can span lines__*
Line breaks stay line breaks, never [br].

## Links and images

[William Rowan Hamilton](https://en.wikipedia.org/wiki/William_Rowan_Hamilton)
https://en.wikipedia.org/wiki/William_Rowan_Hamilton
<https://learnedleague.com>
[a bracket in the address](https://ex.com/a]b) is encoded.

![Alt text doesn't work, so add it after a newline in parentheses](https://i.imgur.com/ivJKx8U.jpeg)

## YouTube

[!["William Rowan Hamilton" by A Capella Science](https://www.youtube.com/watch?v=SZXHoWwBcDc)](https://www.youtube.com/watch?v=SZXHoWwBcDc)

!["William Rowan Hamilton" by A Capella Science](https://www.youtube.com/watch?v=SZXHoWwBcDc)

![](https://youtu.be/SZXHoWwBcDc)

## What goes nowhere

[a script](javascript:alert(1)), [a relative address](/api/ask) and ![an http image](http://ex.com/a.png) are their text alone.
<b>HTML</b> and <script>alert(1)</script> are the characters typed.
[b]BBCode typed in the text[/b] passes through as typed.

## The Coach's sample

First, a huge thank you to the playtesters:
@bob
And congratulations to the winners: @frank

***

> {AS: Q1}1. The four science YouTubers arrayed in the image below are paying homage to a notable Irish physicist, whose character later raps "And no one uses my quaternions, But just you wait, just you wait". **What's his name, man?**
>
> ...BUT NOT...
>
> the progenitors in "Viable offspring derived from fetal and adult mammalian cells" (Wilmut, Schnieke et al., Nature 1997 Feb 27;385(6619):810-3) [Click here](https://learnedleague.com/images/art/7998/7998_1_893016.png)

Answer: ~~**(WILLIAM ROWAN / LEWIS) HAMILTON**~~
Correct Answer %:
{Add Optional Text For Q1 Here or Delete}

> {AS: Q2}2. **What name** will be borne by CVN-80, the third of the Gerald R. Ford-class aircraft carriers? That storied name is also contemplated for a future vessel with hull number NCC-1701... ...OR ELSE... Tubbs' Ferrari-driving vice-squad partner

Answer: ~~**ENTERPRISE (USS ENTERPRISE, CVN-80 / ENTERPRISE RENT-A-CAR)**~~
Correct Answer %: 76
