=== LCC Virtual Book Fair ===
Contributors: lifecoachcode
Requires at least: 5.8
Requires PHP: 7.4
Stable tag: 1.2.1
License: GPL-2.0-or-later

The Virtual Book Fair of Life Coach Code as a full-screen page on this site: a walkable 3D book
fair with every author and book, the Speak Your Book live event, an AI guide and messages to the
authors.

== Install ==
1. Plugins > Add New > Upload Plugin, choose lcc-virtual-book-fair.zip, Install Now, Activate.
2. Settings > Virtual Book Fair > Create the fair's page. It is created as a draft at
   /virtual-book-fair/: preview it, then publish it.
   (Or choose the template "Virtual Book Fair (full screen)" for any page.)
3. On the same settings screen, as they are confirmed: the event's start time, the registration
   form (its link or the Google Forms embed code), the Zoom link and the programme (one line per
   talk or break, e.g.
   "5:00 pm | Chuck Barnard | Raising resilient teens | 20" or "5:20 pm | Break"); the OpenAI key
   for the guide; the authors' email addresses for "Send a message".

== Notes ==
- The fair uses the whole page, without the theme's header and footer.
- If the site uses a page cache, it is cleared for the fair's page when the settings are saved.
  If visitors still see the old version, purge the cache.
- If a security plugin blocks the WordPress REST API for visitors, allow /wp-json/lcc-fair/v1/.
- "Send a message" opens a ready-written email in Gmail or the visitor's own email app; the
  visitor sends it from their own address, so the site sends no email itself.
- Visitors can set reminders for talks (30, 10 and 5 minutes before); between the talks the
  fair offers a breathing minute, wishing lanterns and the Book Oracle's three questions.
- Register free opens the Google Form in a window inside the fair, at any time. The talks open
  on Zoom in a new tab: Join on Zoom appears 15 minutes before the start, and each talk has its
  own Watch on Zoom button while it is on.
- Visual quality (in the fair's menu): Auto, High, Balanced or Light. Auto steps down by itself
  on devices that can't keep up, and the fair rests when nobody moves or a window covers it.
- Live presence (visitors seeing each other) runs through a free public relay, not this server.
- The earlier "LCC Virtual Book Fair Guide" plugin is no longer needed; its OpenAI key carries over.
- Deleting the plugin removes its settings; the page stays.
