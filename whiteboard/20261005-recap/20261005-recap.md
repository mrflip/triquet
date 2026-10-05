## How Learned League BBCode Tags work in message-board mode

* Translate ~~strikeout text~~ to spoilers. If the ~~strikeout text {AS: Question 3's answer}~~ contains the string `{AS:`, capture the text from there to the end of the AST's strikeout block and supply it to the annotation, detatching `{AS:` and any trailing `}`. (I assume the AST does nothing with the braced text?)
* Quote blocks:
  - If a quote block starts `\s*\{AS:\s*.*?\}\s*` convert to bbcode quotes:
    `> {AS: bob}Hi, I'm bob\n` -> [quote="bob"]
  - If it does not, convert with `[list]` as shown below, using newlines and leading spaces as shown.
  - Do apply the "convert every run of four initial spaces to a quote level, pre-ast".
  - Don't rescue the remainder leading spaces: `      text` 6 spaces, or 2 or 10, .would have `[list]  text`...
* Bulleted lists: as shown. Don't try to apply a workaround for the pecadilloes demonstrated.
* code blocks: apply as shown, also no workarounds
* Newlines should not be converted to [br]; do not try to detect them.
* Convert underline, bold and italics as shown. Apply bolding that crosses lines in the way that's easiest.
* URLs: convert any non-image url to (with text, even if empty) `[url=https/wh.at/evs.html]Link Text[/url]`; plain link (auto-detected or plain) to `[url]link[/url]` format
  - exception: for a youtube image link, find and extract the video ID -- a library is welcome, or a regex, but not an api call. Add it with the youtube bbcode: `\n[youtube]{vid}[/youtube]\n\n`. If there is link text on the url, make a url tag after two newlines, then one newline: `\n[youtube]{vid}[/youtube]\n\n[url={original full youtube url}]link text[/url]`
    - if there's alt text and no wrapping link, the caption will be a link using the video url
    - if there's a wrapping link, use the "image" url as the embed, and the wrapping link in the caption around the text. Treat alt text and extra link text include both or either
    - if there's no alt text or wrapping link, omit the caption and its trailing newlines


Here is the Learned League markup, as tried on the boards; if the above disagrees, correct to what's below.

```text
[spoiler=Hi I am the spoiler animation]Bruce Willis is dead[/spoiler]
[spoiler]The annotation isn't required[/spoiler]

You indent with an unbulleted list:
    indenting by spaces does nothing
    [list]Convert quotes without an {AS:} block to lists, with the tag on the same line as the text. Spaces inserted for style, they're ignored.
        [list]this is indented twice, the spaces are for style. Go by quote level (four spaces or `> `); don't try to rescue the <=3 leading spaces[/list][/list]

[*] not bulleted
* not bulleted
[list]
[*] bulleted. Will have a space placed above it (the newline following the tag), that's ok
   [*] bulleted at same level, so don't do this
[*] [*] bulleted once, following a blank bulleted line, so don't do this
[*] main bullet with sub bullets: use a second list tag
  [list]
    [*] bulleted indented at level two A
    [*] bulleted indented at level two B
  [/list]
[*] bulleted to the left level one[/list]
[list=1]
[*] Point '1.' (regardless of what is put in the list= statement)
[*] Second Point,
  continued
  [quote="fleas"]Adam
Had 'em[/quote]
[*] Third point[/list]
[list=a]
[*] Point "a." (regardless of what is put in the list= statement)
[*] Point "b."[/list]

[code]wwww iii lll 111 iii lll 111 - - -[/code]
[code]wwww iii lll 111 www mmm — — —[/code]

[code]
ssuuuup
code
This earns a code block but doesn't monospace? Anyway we'll include it
[/code]

[quote="bob"]
Hi I[br][br]am [br]bob.  The '[br]' codes in message-board mode don't do anything: they render directly
[/quote]

Text may be [u]underlined to underscore[/u], [i]italicized for extraness[/i], or [b]bolded for boldness[/b].
It [i]
 does understand [b]nested[/b] text, [u]and
it can span lines[/u]
[/b]

[url=https://en.wikipedia.org/wiki/William_Rowan_Hamilton]William Rowan Hamilton[/url]
[url]https://en.wikipedia.org/wiki/William_Rowan_Hamilton[/url]
[img]https://i.imgur.com/ivJKx8U.jpeg[/img]
[list](Alt text doesn't work, so add it after a newline in parentheses)[/list]

[code]
Either of these markdowns (a link wrapping an image with a recognized youtube hostname, or unwrapped) should make an embed line and a caption line, with extra newline separating each --
Markdown:
  [!["William Rowan Hamilton" by A Capella Science](https://www.youtube.com/watch?v=SZXHoWwBcDc)](https://www.youtube.com/watch?v=SZXHoWwBcDc)
  !["William Rowan Hamilton" by A Capella Science](https://www.youtube.com/watch?v=SZXHoWwBcDc)
[/code]

[youtube]SZXHoWwBcDc[/youtube]

[url=https://www.youtube.com/watch?v=SZXHoWwBcDc]"William Rowan Hamilton" by A Capella Science[/url]

 If the link text is empty, skip the caption: `\n\n[youtube]SZXHoWwBcDc[/youtube]\n\n`.
```