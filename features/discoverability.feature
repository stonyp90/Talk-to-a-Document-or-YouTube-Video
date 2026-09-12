Feature: Be findable and quotable by search and answer engines

  A product explained by a twenty-four second video is invisible to any reader
  that cannot watch one. The same twenty-four seconds are also published as
  linked data, as plain text, and on YouTube, so a search result or an
  assistant can answer a question about Ursly without guessing.

  Scenario: Describe the page and its introduction as linked data
    When the English page describes itself to a crawler
    Then the organization, the site and the application are named
    And the introduction is described with its duration and its transcript

  Scenario: Point the introduction at YouTube once it is published there
    Given the introduction is published on YouTube
    When the English page describes itself to a crawler
    Then the introduction links to its page on YouTube

  Scenario: Keep the introduction reachable before it reaches YouTube
    Given the introduction is not published on YouTube
    When the English page describes itself to a crawler
    Then the introduction links to the file this origin serves

  Scenario: Describe the introduction in the language being read
    When the French page describes itself to a crawler
    Then the introduction is described in French

  Scenario: Offer every page and every translation to a crawler
    When the sitemap is built
    Then each language of the home page is listed with its translations
    And the crawling policy welcomes crawlers and keeps the API out

  Scenario: Offer a plain reading for models that never render a page
    When a model reads the plain text summary
    Then it finds the product, its pages and the words of the introduction
