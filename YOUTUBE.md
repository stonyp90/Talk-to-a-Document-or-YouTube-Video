# Publishing the introduction on YouTube

The introduction is the argument for Ursly, and this origin is the only place
it can be watched. That is the wrong place for it: search engines and answer
engines already crawl YouTube, and they will quote a video there long before
they fetch an MP4 from a product site. Publishing the two narrations there and
naming their ids is what connects the two.

Nothing in this repository can do the upload; it needs the Ursly account. What
follows is the whole of the human step.

## What to upload

Both files are rendered by `node scripts/brand/intro-video.mjs` and committed:

| Language | File                                       |
| -------- | ------------------------------------------ |
| English  | `apps/web/public/brand/ursly-intro.en.mp4` |
| French   | `apps/web/public/brand/ursly-intro.fr.mp4` |

Upload the matching `.vtt` file beside each one as the subtitle track. They are
generated from the same copy as the video, so they are exact, and an accurate
subtitle track is the single largest thing you can hand a crawler about a video.

## What to call them

The channel should say what the product says. The video argues, in order, that
this is the next generation of internet, that voice is the way in, that motion
is what comes next, and that the keyboard is the old way. The listings should
argue the same thing.

**English title:** Ursly — internet without a keyboard and a mouse

**English description:**

> The next generation of internet. Bring a PDF or a captioned YouTube video and
> ask your questions by voice, without a keyboard.
>
> Voice to action is the way in. Motion to action is in beta, built for the
> headsets coming next. The keyboard still works — it is simply no longer the
> way in.
>
> Try it: https://ursly.io/en

**French title:** Ursly — internet sans clavier ni souris

**French description:**

> La nouvelle génération d'internet. Apportez un PDF ou une vidéo YouTube
> sous-titrée et posez vos questions à la voix, sans clavier.
>
> La voix est la porte d'entrée. Le mouvement arrive en bêta, pensé pour les
> casques qui arrivent. Le clavier fonctionne toujours — ce n'est simplement
> plus la porte d'entrée.
>
> Essayez : https://ursly.io/fr

Set each video's language and its subtitle language, and link the two as
translations of each other rather than uploading one and letting YouTube guess.

## After the upload

Take the eleven-character id out of each watch URL — the `v=` parameter — and
set it as a repository variable, then redeploy:

| Variable                    | Value                                                |
| --------------------------- | ---------------------------------------------------- |
| `INTRO_VIDEO_YOUTUBE_ID_EN` | the id of the English video                          |
| `INTRO_VIDEO_YOUTUBE_ID_FR` | the id of the French video                           |
| `SITE_SAME_AS`              | the channel URL, comma-joined with any other profile |

These are read when the pages, the sitemap and `/llms.txt` are prerendered, so
they are build arguments and a change needs a new deployment, not a restart.
Once they are set, every page's `VideoObject` points its `url` and `embedUrl`
at YouTube while keeping the self-hosted file as `contentUrl`, and `/llms.txt`
offers the watch link instead of the raw MP4.

Leaving them unset is not a failure. The structured data then describes the
file this origin serves, which is what it does today.
