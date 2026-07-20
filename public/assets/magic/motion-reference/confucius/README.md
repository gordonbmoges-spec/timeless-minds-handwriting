# Confucius opening-sequence test

Status: **reference generated, runtime use not approved**.

This folder contains the first single-book production test requested before generating the other seven books.

- `sprite-sheet.png`: eight-stage RGBA source sheet.
- `frame-01.png` through `frame-08.png`: individually cropped transparent frames.
- `confucius-opening-review.mp4`: four-second review composite over the current archive background at two generated states per second.

## QA result

Passed:

- The camera stays near-overhead and the book floats without a tabletop.
- The emerald leather, bamboo/cloud tooling, jade cabochon, brass corners, warm parchment, and raised spine remain recognizably Confucian and distinct from the other books.
- The extracted images are true RGBA assets. Exterior test pixels have alpha `0`; opaque book pixels have alpha `255`.
- Cover thickness, page-block thickness, gutter depth, and the last page curl are visible.

Not yet passed:

- The generated spine anchor drifts between cells instead of remaining at one fixed screen position.
- The transition from frame 05 to frame 07 changes the left page block too abruptly; frame 06 does not provide a sufficiently believable 135-degree bridge.
- Because of that geometry jump, this sequence must not be copied to the other seven books or wired into production yet.

Next correction: retain frames 01–05 and 07–08 as visual references, regenerate the vertical-to-open bridge, then normalize every frame to one shared spine anchor before a browser animation test.
