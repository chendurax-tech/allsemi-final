// Insights: the fixed lists and the selection rules the Insights pages
// and the admin share.
//
// The articles themselves are not here. They are stored in the
// database, edited in the admin (Insights) and read by the public
// pages from the backend (lib/usePublicData.js: useInsights and
// useInsight), which returns published articles only.
//
// An article as the public API returns it:
//   slug, title, excerpt
//   category        one of CATEGORIES
//   topics          the filter chips; topics[0] is the label on cards
//   tags, author, date (ISO), readTime, featured, showOnLanding,
//   landingOrder
//   image, alt      cover image link and its description
//   seoTitle, seoDescription  optional; the article page falls back to
//                   the title and the excerpt
//   body            typed blocks (p, h2, quote, list), article page only

// The topic chips of the Insights page, in this order.
export const TOPICS = ['SEMICONDUCTOR', 'AUTOMOTIVE', 'AI & CLOUD', 'AEROSPACE', 'FINTECH', 'HEALTHCARE', 'TALENT', 'HIRING'];

// The category choices and the default byline in the admin editor.
export const CATEGORIES = ['Semiconductor', 'Automotive', 'AI & Cloud', 'Aerospace', 'FinTech', 'Healthcare', 'Talent', 'Hiring'];
export const DEFAULT_AUTHOR = 'ALLSEMIS Editorial';

const sameTopic = (a, b) => String(a).toUpperCase() === String(b).toUpperCase();

// Whether an article carries a topic. Topics typed in the admin are
// matched without regard to capitals.
export function hasTopic(article, topic) {
  return article.topics.some((item) => sameTopic(item, topic));
}

// The chips to offer: the fixed list, then any other topic a published
// article carries, so an article is never unreachable by filter.
export function topicChips(articles) {
  const extra = [];
  for (const article of articles) {
    for (const topic of article.topics) {
      const name = String(topic).toUpperCase();
      if (!TOPICS.includes(name) && !extra.includes(name)) extra.push(name);
    }
  }
  return [...TOPICS, ...extra];
}

// The article that leads the Insights page: the newest one marked
// Featured, or the newest article when none is. `articles` is newest
// first, as the backend returns it.
export function leadArticle(articles) {
  return articles.find((article) => article.featured) || articles[0] || null;
}

// The articles for the landing page section: the ones switched on for
// it in the admin ("Show on landing page"), in their landing page
// order, lowest number first. Articles with the same number keep the
// list's order, which is newest first. Every chosen article is
// returned: the section lays out however many there are.
export function landingArticles(articles) {
  return articles
    .filter((article) => article.showOnLanding === true)
    .map((article, index) => ({ article, index, order: Number(article.landingOrder) || 0 }))
    .sort((x, y) => x.order - y.order || x.index - y.index)
    .map((entry) => entry.article);
}

// Suggested reading for an article: the other published articles that
// share the most topics with it, in the list's order when tied.
export function relatedArticles(articles, current, count = 3) {
  return articles
    .filter((article) => article.slug !== current.slug)
    .map((article) => ({ article, score: article.topics.filter((topic) => hasTopic(current, topic)).length }))
    .sort((x, y) => y.score - x.score)
    .slice(0, count)
    .map((entry) => entry.article);
}
