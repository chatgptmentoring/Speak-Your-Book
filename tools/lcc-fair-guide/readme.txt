=== LCC Virtual Book Fair Guide ===
Connects the AI guide of the Virtual Book Fair to OpenAI, keeping the API key on this site.

== Install ==
1. WordPress admin > Plugins > Add New > Upload Plugin, choose lcc-fair-guide.zip, Install, Activate.
2. Settings > Fair Guide: paste the OpenAI API key, keep the model (gpt-4o-mini) and Save.
3. Copy the address shown on that page (…/wp-json/lcc-fair/v1/guide) into FAIR_GUIDE.endpoint
   in the fair's assets/js/books.js, and publish the fair.
4. In your OpenAI account, set a monthly budget limit for the project the key belongs to.

== Notes ==
- Only the fair's own address (Settings > Fair Address) may use the guide.
- Each visitor can ask a limited number of questions per hour, and there is a daily total.
  When a limit is reached, the guide falls back to its built-in answers.
- If a security plugin blocks the WordPress REST API for visitors, allow /wp-json/lcc-fair/v1/guide.
