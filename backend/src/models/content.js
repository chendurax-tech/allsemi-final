import mongoose from 'mongoose';
import { CONTENT_STATUSES, LOCATION_TYPES, LOCATION_STATUSES } from '../config/constants.js';
import { baseSchemaPlugin } from './plugins.js';
import { mediaSchema } from './shared.js';

const { Schema } = mongoose;

// Adds the worked-out `showOnLanding` answer to the JSON the admin API
// returns for a record (see insightOnLanding and storyOnLanding).
function withLandingFlag(schema, onLanding) {
  const base = schema.get('toJSON');
  schema.set('toJSON', {
    ...base,
    transform(doc, ret) {
      const out = base.transform(doc, ret);
      out.showOnLanding = onLanding(doc);
      return out;
    },
  });
}

/*
  Website content models: Insight, Story, Expertise, Service, Location.
  Their shapes follow the content the public site already renders, so
  the existing pages can read them without a redesign. Only records
  with status 'published' (and, for locations, active) are returned by
  the public API.
*/

const bodyBlockSchema = new Schema({
  type: { type: String, enum: ['p', 'h2', 'quote', 'list'], required: true },
  text: { type: String, default: '' },
  items: { type: [String], default: undefined },
}, { _id: false });

const insightSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 100 },
  excerpt: { type: String, default: '', maxlength: 600 },
  category: { type: String, default: '', trim: true, maxlength: 60 },
  tags: { type: [String], default: [] },
  topics: { type: [String], default: [] },
  image: { type: mediaSchema, default: () => ({}) },
  body: { type: [bodyBlockSchema], default: [] },
  author: { type: String, default: '', trim: true, maxlength: 120 },
  date: { type: String, default: '' }, // publish date, YYYY-MM-DD
  readTime: { type: String, default: '', trim: true, maxlength: 40 },
  featured: { type: Boolean, default: false },
  // The landing page section. `showOnLanding` has no default on purpose:
  // a record saved before the field existed has no value, and
  // insightOnLanding() below then follows `featured`, which is what
  // decided the landing page until now. The admin API stores that
  // answer the first time such a record is edited (see the insights
  // controller). `landingOrder` sorts the chosen articles, lowest first.
  showOnLanding: { type: Boolean },
  landingOrder: { type: Number, default: 0 },
  status: { type: String, enum: CONTENT_STATUSES, default: 'draft', index: true },
  seoTitle: { type: String, default: '', maxlength: 200 },
  seoDescription: { type: String, default: '', maxlength: 400 },
}, { timestamps: true });
insightSchema.plugin(baseSchemaPlugin);

// Whether an article is on the landing page. An article that was never
// given a value follows its Featured flag.
export function insightOnLanding(article) {
  return typeof article.showOnLanding === 'boolean' ? article.showOnLanding : article.featured === true;
}
// The admin sees the same answer the public site gets, so the switch in
// the editor never disagrees with the landing page.
withLandingFlag(insightSchema, insightOnLanding);
export const Insight = mongoose.models.Insight || mongoose.model('Insight', insightSchema);

const storySchema = new Schema({
  quote: { type: String, required: true, maxlength: 1200 },
  name: { type: String, default: '', trim: true, maxlength: 120 },
  role: { type: String, default: '', trim: true, maxlength: 160 },
  photo: { type: mediaSchema, default: () => ({}) },
  order: { type: Number, default: 0 },
  // The landing page section. No default on purpose: a story saved
  // before the field existed has no value and stays on the landing page,
  // as it was (see storyOnLanding below). `order` above is the order on
  // the landing page.
  showOnLanding: { type: Boolean },
  status: { type: String, enum: CONTENT_STATUSES, default: 'draft', index: true },
}, { timestamps: true });
storySchema.plugin(baseSchemaPlugin);

// Whether a story is on the landing page. A story that was never given
// a value is.
export function storyOnLanding(story) {
  return story.showOnLanding !== false;
}
withLandingFlag(storySchema, storyOnLanding);
export const Story = mongoose.models.Story || mongoose.model('Story', storySchema);

const expertiseSchema = new Schema({
  // The stable key the site's code uses for this sector (for example
  // "embedded"); the slug is its public URL segment.
  key: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  num: { type: String, default: '', trim: true, maxlength: 4 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  shortName: { type: String, default: '', trim: true, maxlength: 40 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 100 },
  desc: { type: String, default: '', maxlength: 400 },
  image: { type: mediaSchema, default: () => ({}) },
  introduction: { type: String, default: '', maxlength: 600 },
  overview: { type: String, default: '', maxlength: 4000 },
  domains: { type: [String], default: [] },
  roles: { type: [String], default: [] },
  hiringChallenges: { type: [String], default: [] }, // "Title: detail"
  processFlow: { type: [String], default: [] },
  representativeSearches: {
    type: [new Schema({ ref: String, title: String, requirement: String, signals: [String] }, { _id: false })],
    default: [],
  },
  relatedInsight: { type: String, default: '', trim: true, maxlength: 100 }, // an insight slug
  status: { type: String, enum: CONTENT_STATUSES, default: 'draft', index: true },
}, { timestamps: true });
expertiseSchema.plugin(baseSchemaPlugin);
export const Expertise = mongoose.models.Expertise || mongoose.model('Expertise', expertiseSchema);

const serviceSchema = new Schema({
  num: { type: String, default: '', trim: true, maxlength: 4 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 100 },
  icon: { type: String, default: 'die', trim: true, maxlength: 40 },
  description: { type: String, default: '', maxlength: 800 },
  headline: { type: String, default: '', maxlength: 240 },
  lead: { type: String, default: '', maxlength: 800 },
  fitTitle: { type: String, default: '', maxlength: 200 },
  fit: { type: [String], default: [] },
  processTitle: { type: String, default: '', maxlength: 200 },
  process: { type: [String], default: [] }, // "Step: detail"
  receiveTitle: { type: String, default: '', maxlength: 200 },
  receive: { type: [String], default: [] },
  tagsTitle: { type: String, default: '', maxlength: 200 },
  tags: { type: [String], default: [] },
  questions: { type: [String], default: [] }, // "Question | Answer"
  ctaLabel: { type: String, default: '', maxlength: 80 },
  ctaTo: { type: String, default: '', maxlength: 200 },
  status: { type: String, enum: CONTENT_STATUSES, default: 'draft', index: true },
}, { timestamps: true });
serviceSchema.plugin(baseSchemaPlugin);
export const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);

const locationSchema = new Schema({
  key: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  country: { type: String, default: '', trim: true, maxlength: 80 },
  region: { type: String, default: '', trim: true, maxlength: 40 },
  label: { type: String, default: '', trim: true, maxlength: 120 },
  // 'office' is a confirmed ALLSEMIS office. 'network' is a named
  // network node and must never carry an address or contact details.
  type: { type: String, enum: LOCATION_TYPES, default: 'network' },
  status: { type: String, enum: LOCATION_STATUSES, default: 'listed' },
  isHeadquarters: { type: Boolean, default: false },
  address: { type: [String], default: [] },
  phone: { type: String, default: '', maxlength: 40 },
  email: { type: String, default: '', maxlength: 254 },
  hours: { type: [String], default: [] },
  lat: { type: Number, required: true, min: -90, max: 90 },
  lon: { type: Number, required: true, min: -180, max: 180 },
  description: { type: String, default: '', maxlength: 400 },
  labelSide: { type: String, enum: ['left', 'right'], default: 'right' },
  labelRaise: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });
locationSchema.plugin(baseSchemaPlugin);
export const Location = mongoose.models.Location || mongoose.model('Location', locationSchema);
