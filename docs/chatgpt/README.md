# ARLive Book Studio for ChatGPT

A reusable ChatGPT setup that makes every ARLive book the same way: same sketchbook art style,
same file names, same `pages.json`. It produces two-page spreads like a real open sketchbook; ARLive
splits them into facing pages in the flip-book reader.

## Set it up once

**ChatGPT Project** (easiest): ChatGPT → *Projects* → *New project* "ARLive Book Studio" →
*Instructions* → paste everything from [`arlive-book-studio-instructions.md`](arlive-book-studio-instructions.md) → Save.

**or a Custom GPT**: *Explore GPTs* → *Create* → *Configure* → paste the same text into *Instructions*,
turn on *Image Generation*, name it "ARLive Book Studio".

## Make a book

1. Start a **new chat in the project** for each book (the style stays consistent within a chat).
2. Send a topic, for example the test book in [`test-story-message.md`](test-story-message.md).
3. Check the plan, reply **GO**, then **NEXT** after each picture. Save each picture with the name
   ChatGPT gives (`cover.png`, `spread-01.png`, …).
4. Reply **JSON** and save the code block as `pages.json` in the same folder as the pictures.
5. In ARLive: **Books & targets → New book**, page size **Sketchbook 3:4**, then drop all the pictures
   and `pages.json` together with **"two-page spreads"** ticked. Open **Preview book**.

Tips: if a picture comes out with words on it, or the subject sits in the gutter, reply
"Redo it following the rules". Claude can plan books the same way with the `arlive-book` skill.
