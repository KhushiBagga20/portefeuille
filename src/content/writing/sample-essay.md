---
title: An essay goes here
kind: essay
sample: true
dek: Sample text that doubles as the instructions for adding your own.
---
This page is a stand-in. Nothing on it was written as an essay; it is here to show how an essay will sit in the room, and to explain how to put a real one in its place. The first paragraph of any essay is set a little larger than the rest, like this one.

## Adding a piece

Every piece of writing is one file in the folder `src/content/writing/`. Make a new file there whose name ends in `.md`. The name of the file becomes the address of the piece, so `on-keyboards.md` is read at `/playground/writing/on-keyboards/`.

At the top of the file, between two lines of three dashes, say what it is:

- `title` is the title.
- `kind` is `poem`, `essay` or `fiction`. It decides which shelf the piece sits on and how the text is set.
- `side` is `personal` or `professional`: which half of the room it sits in. Leave it out and it is personal.
- `source` is optional: the address where the piece was first published.
- `date` is optional, written like `2026-03-14`.
- `dek` is an optional line that appears under the title.
- `status: draft` keeps a piece off the published site while you work on it.

Everything under the second line of dashes is the piece itself.

## What the text can do

Paragraphs are separated by a blank line. A line that starts with `##` becomes a heading like the ones on this page. You can mark *emphasis* with single asterisks and **stronger emphasis** with double ones, and [links](/playground/writing/) work the way they usually do.

> A line that starts with a greater-than sign becomes a pulled quotation, set apart from the text around it.

A line of three dashes on its own makes a break in the text, for a change of scene or a change of subject.

---

## When the samples go away

The three sample pieces disappear by themselves as soon as there is one real piece in the folder. You do not need to delete them first, although you can.
