=== LCC Virtual Book Fair ===
Contributors: lifecoachcode
Requires at least: 5.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-2.0-or-later

The Virtual Book Fair of Life Coach Code as a full-screen page on this site: a walkable 3D book
fair with every author and book, the Speak Your Book live event, an AI guide and messages to the
authors.

== Install ==
1. Plugins > Add New > Upload Plugin, choose lcc-virtual-book-fair.zip, Install Now, Activate.
2. Settings > Virtual Book Fair > Create the fair's page. It is created as a draft at
   /virtual-book-fair/: preview it, then publish it.
   (Or choose the template "Virtual Book Fair (full screen)" for any page.)
3. On the same settings screen, as they are confirmed: the event's start time, the Zoom and
   live-stream links and who speaks when; the OpenAI key for the guide; the authors' email
   addresses for messages. Click "Send me a test email" to check that this site can send email.

== Notes ==
- The fair uses the whole page, without the theme's header and footer.
- If the site uses a page cache, it is cleared for the fair's page when the settings are saved.
  If visitors still see the old version, purge the cache.
- If a security plugin blocks the WordPress REST API for visitors, allow /wp-json/lcc-fair/v1/.
- Messages to authors are sent with the site's own email (wp_mail). If the test email does not
  arrive, set up an SMTP plugin or ask the host.
- Live presence (visitors seeing each other) runs through a free public relay, not this server.
- The earlier "LCC Virtual Book Fair Guide" plugin is no longer needed; its OpenAI key carries over.
- Deleting the plugin removes its settings; the page stays.
