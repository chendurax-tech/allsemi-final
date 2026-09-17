import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import Connecting from './components/Connecting.jsx';
import Services from './components/Services.jsx';
import Expertise from './components/Expertise.jsx';
import Stories from './components/Stories.jsx';
import Insights from './components/Insights.jsx';
import Facts from './components/Facts.jsx';
import Enquiry from './components/Enquiry.jsx';
import React from 'react';
import Footer from './components/Footer.jsx';
import { useReveal, useReactiveLetters } from './lib/useReveal.js';

export default function App() {
  useReveal();
  useReactiveLetters();

  return (
    <div className="bg-bg text-text font-body min-h-screen">
      <Header />
      <main>
        <Hero />
        <Connecting />
        <Services />
        <Expertise />
        <Stories />
       
        <Facts />
        <Enquiry />
      </main>
      <Footer />
    </div>
  );
}