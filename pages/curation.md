---
layout: page
title: Curation & Acknowledgements
seo_title: "Curation Disability Heritage Museum Exhibition"
nav_title: Curation
permalink: /curation/
description: "Author information and acknowledgments by Hannah Vogel. Curator of Disability Heritage Museum Exhibition"
prev_url: /shelves/bottom/
prev_label: Bottom Shelf
next_url: /accessibility/
next_label: Accessibility
---

<div class="curation">

  <section class="curation__section" aria-labelledby="curator-heading">
    <h2 id="curator-heading">Curator</h2>
    <div class="curation__bio">
      <div class="curation__bio-text">
        <p>Hannah Vogel is an archaeologist, teaching academic, and PhD candidate researcher in the School of Humanities, Macquarie University (Sydney, Australia). As a leading researcher on ableism and disability, she combines archaeological scholarship with advocacy and experience in museums, public outreach, accessibility, and inclusive pedagogies. Her work has helped shape the emerging field of archaeological disability studies.</p>
        <p>Her recent books include <cite>Disability in Ancient Egypt and Egyptology</cite> (Routledge, 2024) and <cite>Disability Activism in and Out of the Academy</cite> (2026). She has been recognised as an emerging research leader of the inaugural National Disability Leadership Program by the National Disability Research Partnership.</p>
        <p>Check out her <a href="https://researchers.mq.edu.au/en/persons/hannah-vogel/">Macquarie University Profile</a> or <a href="https://hvogel.org/">Website (hvogel.org)</a> for more information about her projects, research, outreach and advocacy.</p>
      </div>
      {%- assign bio_pic = site.data.bio_pic -%}
      <figure class="curation__bio-figure" data-gallery data-gallery-title="Hannah Vogel">
        <div class="curation__bio-stage photo-stage">
          {% include responsive-image.html src=bio_pic.url alt=bio_pic.altText class="curation__portrait" sizes="(max-width: 760px) 100vw, 340px" eager=true full=true %}
          <button type="button"
                  class="photo-expand-btn"
                  data-gallery-enlarge
                  aria-haspopup="dialog"
                  aria-controls="photo-dialog"
                  aria-label="Enlarge photograph of Hannah Vogel"
                  data-kg-keys="Tab > Enter/Space"
                  data-kg-label="Enlarge portrait photo">
            {%- include icon.html name="maximize-2" class="icon" size=18 -%}
          </button>
        </div>
        <figcaption class="curation__portrait-caption" data-gallery-caption>{{ bio_pic.caption | escape }}</figcaption>
      </figure>
    </div>
  </section>

  <section class="curation__section" aria-labelledby="acknowledgements-heading">
    <h2 id="acknowledgements-heading">Acknowledgements</h2>
    <p>This research was undertaken on the lands of the Wallumattagal people of the Dharug Nation, whose cultures and customs have nurtured and continue to nurture this land, since the Dreaming. Their sovereignty was never ceded.</p>
    <p>In most instances, I have chosen to use identity-first disability language as a personal preference. I acknowledge that preferences vary amongst the diverse disability community and respect the choices of each person to express their experiences and embodiments.</p>

    <h3 id="thanks-heading">Thanks</h3>
    <p>Thanks to the <a href="https://www.mq.edu.au/faculty-of-arts/about/gale-history-museum">Gale History Museum</a>, Macquarie University for providing access to the materials for this exhibition, with special thanks to Leila Wallace, Dr Yvonne Inall and Sarah Judd.</p>
    <p>Special thanks to Hannah Newman and Dr Brian Ballsun-Stanton for their work supporting the administrative and technical development of this exhibition and associated website.</p>
    <p>Acknowledgment and thanks to Mike Baber for 3D models and prints, Dave Frame for signage and installation, Vision Australia for tactile fabrication, large-print and braille guides, and Marcus Arruzza for video production and digital scans.</p>
    <p>I acknowledge community consultation was provided by the National Disability Research Partnership staff, especially Catherine Raffaele and Jess Rosenthal. Thanks to the Disability Research Leaders Community of Practice members, especially, Matthew Jackson and Samantha Lilly.</p>
    <p>Thanks for feedback and consultation to Dr Alexandra F. Morris, Amy Cripps, Cecily Bateman, Chaya Kasif, Damian Gilbert, Dr David Chapman, Dr Ewan Coopey, Gessika Crowe, Hannah Newman, Jackie Tang, Dr Julia Hamilton, Dr Katie Shead, Dr Louise Pryke, Marianne Strauss, Dr Narges Safari, Nicole Leong, Penelope Blake, Prof Ronika Power, Sarah Massingham-Porter, Taylah Evans and many other community members who have elected to remain anonymous.</p>
  </section>

  <section class="curation__section" aria-labelledby="funding-heading">
    <h2 id="funding-heading">Funding Bodies</h2>
    <p>This exhibition is funded by the <a href="https://www.ndrp.org.au/">National Disability Research Partnership</a>'s Disability Leadership Program (2026). It is part of Hannah Vogel's PhD project supported by the Commonwealth through an Australian Government Research Training Program Scholarship (<a href="https://doi.org/10.82133/C42F-K220">DOI: https://doi.org/10.82133/C42F-K220</a>).</p>
  </section>

  <section class="curation__section" aria-labelledby="team-heading">
    <h2 id="team-heading">Website Development Team</h2>
    <p>This exhibition website was synthesised from two Macquarie University student capstone prototypes developed by Group 33 and Group 34.</p>
    <div class="curation__teams">
      <div class="curation__team-group">
        <h3 id="team-group33">Group 33</h3>
        <dl class="curation__team">
          {%- for member in site.data.team.group33 -%}
          <div class="curation__team-item">
            <dt>{{ member.role | escape }}</dt>
            <dd>{{ member.name | escape }}</dd>
          </div>
          {%- endfor -%}
        </dl>
      </div>
      <div class="curation__team-group">
        <h3 id="team-group34">Group 34</h3>
        <dl class="curation__team">
          {%- for member in site.data.team.group34 -%}
          <div class="curation__team-item">
            <dt>{{ member.role | escape }}</dt>
            <dd>{{ member.name | escape }}</dd>
          </div>
          {%- endfor -%}
        </dl>
      </div>
    </div>
  </section>

  <section class="curation__section" aria-labelledby="licenses-heading">
    <h2 id="licenses-heading">Software &amp; Asset Licences</h2>
    <p>Exhibition text, photographs, audio descriptions, transcripts, and videos remain © 2026 Hannah Vogel and Gale History Museum. Website code is released under the <a href="https://github.com/{{ site.repository }}/blob/main/LICENSE">MIT License</a>, and full third-party copyright and licence texts are recorded in <a href="https://github.com/{{ site.repository }}/blob/main/NOTICE.md">NOTICE.md on GitHub</a>.</p>
    {% include license-table.html used_for="website" caption="On the website: sent to every visitor" %}
    {% include license-table.html used_for="building" caption="Building and checking the site" %}
  </section>

</div>
