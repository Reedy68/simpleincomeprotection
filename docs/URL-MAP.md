# URL map: live WordPress site to the static site

Every address on the live site keeps its address (no redirects are needed). Checked against the built files: each one exists and is served with HTTP 200 (the checks are repeated in the pull request).

| Old address | New address | Status | Search listing | H1 kept | Title |
| --- | --- | --- | --- | --- | --- |
| / | / | 200 | indexable | yes | was "simpleincomeprotection.co.uk" -> now "Income Protection for Employees \| Simple Income Protection" |
| /income-protection/ | /income-protection/ | 200 | indexable | yes | was "Income Protection - simpleincomeprotection.co.uk" -> now "What Is Income Protection? \| Simple Income Protection" |
| /income-protection/get-quote/ | /income-protection/get-quote/ | 200 | indexable | yes | was "Get Quote - simpleincomeprotection.co.uk" -> now "Get an Income Protection Quote \| Simple Income Protection" |
| /income-protection-cover/ | /income-protection-cover/ | 200 | indexable | yes | was "Income Protection Cover - simpleincomeprotection.co.uk" -> now "Income Protection Cover \| Simple Income Protection" |
| /self-employed/ | /self-employed/ | 200 | indexable | yes | was "Self Employed Income Protection - simpleincomeprotection.co.uk" -> now "Self Employed Income Protection \| Simple Income Protection" |
| /self-employed-quote/ | /self-employed-quote/ | 200 | indexable | yes | was "Self Employed Quote - simpleincomeprotection.co.uk" -> now "Self Employed Quote \| Simple Income Protection" |
| /contact-us/ | /contact-us/ | 200 | indexable | yes | was "Contact Us - simpleincomeprotection.co.uk" -> now "Contact Us \| Simple Income Protection" |
| /privacy-policy/ | /privacy-policy/ | 200 | indexable | yes | was "Privacy Policy - simpleincomeprotection.co.uk" -> now "Privacy Policy \| Simple Income Protection" |
| /cookie-policy/ | /cookie-policy/ | 200 | indexable | yes | was "Cookie Policy - simpleincomeprotection.co.uk" -> now "Cookie Policy \| Simple Income Protection" |
| /terms-and-conditions/ | /terms-and-conditions/ | 200 | indexable | yes | was "Terms And Conditions - simpleincomeprotection.co.uk" -> now "Terms and Conditions \| Simple Income Protection" |
| /thank-you/ | /thank-you/ | 200 | noindex | yes | was "Thank You - simpleincomeprotection.co.uk" -> now "Thank You - simpleincomeprotection.co.uk" |
| /thank-you-2/ | /thank-you-2/ | 200 | noindex | yes | was "Thank You 2 - simpleincomeprotection.co.uk" -> now "Thank You 2 - simpleincomeprotection.co.uk" |
| /form-test/ | /form-test/ | 200 | noindex | yes | was "Form Test - simpleincomeprotection.co.uk" -> now "Form Test - simpleincomeprotection.co.uk" |
| /tag/submission-fail/ | /tag/submission-fail/ | 200 | noindex | yes | was "submission fail - simpleincomeprotection.co.uk" -> now "submission fail - simpleincomeprotection.co.uk" |
| /tag/submission-success/ | /tag/submission-success/ | 200 | noindex | yes | was "submission success - simpleincomeprotection.co.uk" -> now "submission success - simpleincomeprotection.co.uk" |

Also added: /failed/ (noindex, where a lead that could not reach VM is sent), /404.html (custom not-found page), /sitemap.xml, /robots.txt, /llms.txt.

WordPress-only addresses that stop existing (they were never linked or indexed): /wp-json/, /xmlrpc.php, /feed/, /comments/feed/, /wp-sitemap*.xml (replaced by /sitemap.xml), /wp-login.php, /wp-admin/.
