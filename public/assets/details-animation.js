(() => {
  'use strict';

  const selector = 'details.collapsible-group, details.collapsible-section';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controllers = new WeakMap();
  const instances = [];
  const px = (value) => `${value}px`;

  class AnimatedDetails {
    constructor(details) {
      this.details = details;
      const firstChild = details.firstElementChild;
      this.summary = firstChild && firstChild.matches('summary.collapsible-summary')
        ? firstChild
        : null;
      this.animating = false;
      this.desiredOpen = details.open;
      this.frame = null;
      this.fallbackTimer = null;
      this.onClick = this.onClick.bind(this);
      this.onToggle = this.onToggle.bind(this);
      this.onTransitionEnd = this.onTransitionEnd.bind(this);
    }

    connect() {
      if (!this.summary) return;
      this.summary.addEventListener('click', this.onClick);
      this.details.addEventListener('toggle', this.onToggle);
      this.details.addEventListener('transitionend', this.onTransitionEnd);
    }

    onToggle() {
      if (!this.animating) this.desiredOpen = this.details.open;
    }

    onTransitionEnd(event) {
      if (
        this.animating &&
        event.target === this.details &&
        event.propertyName === 'height'
      ) {
        this.settle(this.desiredOpen);
      }
    }

    onClick(event) {
      if (event.defaultPrevented) return;

      if (reduceMotion.matches) {
        if (this.animating) this.settle(this.desiredOpen);
        return;
      }

      event.preventDefault();
      this.settleAnimatingAncestors();
      const targetOpen = this.animating ? !this.desiredOpen : !this.details.open;
      this.animateTo(targetOpen);
    }

    settleAnimatingAncestors() {
      let node = this.details.parentElement;
      while (node) {
        const ancestorDetails = node.closest(selector);
        if (!ancestorDetails) break;
        const ancestor = controllers.get(ancestorDetails);
        if (ancestor && ancestor.animating) ancestor.settle(true);
        node = ancestorDetails.parentElement;
      }
    }

    settleAnimatingDescendants() {
      const nestedDisclosures = this.details.querySelectorAll(selector);
      for (let index = 0; index < nestedDisclosures.length; index += 1) {
        const nestedDetails = nestedDisclosures[index];
        const nested = controllers.get(nestedDetails);
        if (nested && nested.animating) nested.settle(nested.desiredOpen);
      }
    }

    cancelPendingCompletion() {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      if (this.fallbackTimer !== null) clearTimeout(this.fallbackTimer);
      this.frame = null;
      this.fallbackTimer = null;
    }

    animateTo(targetOpen) {
      const startHeight = this.details.getBoundingClientRect().height;
      this.cancelPendingCompletion();
      this.animating = true;
      this.desiredOpen = targetOpen;

      this.details.style.transition = 'none';
      this.details.style.height = px(startHeight);
      this.details.classList.add('is-animating');
      this.details.classList.remove('is-opening', 'is-closing');

      this.settleAnimatingDescendants();
      this.details.open = true;

      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        if (!this.animating || this.desiredOpen !== targetOpen) return;
        const endHeight = targetOpen
          ? this.details.scrollHeight
          : this.summary.getBoundingClientRect().height;
        this.startTransition(targetOpen, startHeight, endHeight);
      });
    }

    startTransition(targetOpen, startHeight, endHeight) {
      if (Math.abs(endHeight - startHeight) < 1) {
        this.settle(targetOpen);
        return;
      }

      this.details.getBoundingClientRect();
      const duration = Math.min(
        360,
        Math.max(180, Math.abs(endHeight - startHeight) * 0.45),
      );
      this.details.style.setProperty('--details-duration', `${duration}ms`);
      this.details.classList.toggle('is-opening', targetOpen);
      this.details.classList.toggle('is-closing', !targetOpen);
      this.details.getBoundingClientRect();
      this.details.style.removeProperty('transition');

      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        if (!this.animating || this.desiredOpen !== targetOpen) return;
        this.details.style.height = px(endHeight);
        this.fallbackTimer = setTimeout(() => {
          this.fallbackTimer = null;
          if (this.animating && this.desiredOpen === targetOpen) this.settle(targetOpen);
        }, duration + 100);
      });
    }

    settle(open) {
      this.cancelPendingCompletion();
      this.animating = false;
      this.desiredOpen = open;
      this.details.style.transition = 'none';
      this.details.open = open;
      this.details.style.removeProperty('height');
      this.details.classList.remove('is-animating', 'is-opening', 'is-closing');
      this.details.style.removeProperty('--details-duration');
      this.details.getBoundingClientRect();
      this.details.style.removeProperty('transition');
    }
  }

  const disclosures = document.querySelectorAll(selector);
  for (let index = 0; index < disclosures.length; index += 1) {
    const details = disclosures[index];
    const controller = new AnimatedDetails(details);
    if (!controller.summary) continue;
    controllers.set(details, controller);
    instances.push(controller);
  }
  for (const controller of instances) controller.connect();

  const finishMotion = (event) => {
    if (!event.matches) return;
    for (const controller of instances) {
      if (controller.animating) controller.settle(controller.desiredOpen);
    }
  };
  if (typeof reduceMotion.addEventListener === 'function') {
    reduceMotion.addEventListener('change', finishMotion);
  } else if (typeof reduceMotion.addListener === 'function') {
    reduceMotion.addListener(finishMotion);
  }
})();
