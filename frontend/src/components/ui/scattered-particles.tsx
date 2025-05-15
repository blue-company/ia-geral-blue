"use client"

import { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  targetX: number;
  targetY: number;
  element: HTMLDivElement;
}

interface ScatteredParticlesProps {
  offsetY?: number;
}

export function ScatteredParticles({ offsetY = 0 }: ScatteredParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const centerXRef = useRef<number>(0);
  const centerYRef = useRef<number>(0);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear any existing particles
    containerRef.current.innerHTML = '';
    
    // Get window dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Container dimensions for the circle formation
    const containerWidth = 400;
    const containerHeight = 400;
    const centerX = windowWidth / 2;
    const centerY = windowHeight / 2;
    
    // Store center coordinates for use in animation functions
    centerXRef.current = centerX;
    centerYRef.current = centerY;
    
    // Create particles
    const particleCount = 300; // Number of particles
    const radius = containerWidth / 2; // Radius of the circle when particles come together
    const particles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      // Random position across the screen for scattered state
      const randomX = Math.random() * windowWidth;
      const randomY = Math.random() * windowHeight;
      
      // Calculate position on a circle for the gathered state
      const randomRadius = radius * (0.7 + Math.random() * 0.3);
      const angle = Math.random() * Math.PI * 2;
      const circleX = Math.cos(angle) * randomRadius + centerX;
      const circleY = Math.sin(angle) * randomRadius + centerY - offsetY;
      
      // Create particle element
      const particle = document.createElement('div');
      particle.className = 'magenta-particle';
      
      // Make some particles larger for better visibility
      if (Math.random() > 0.8) {
        particle.style.width = '2px';
        particle.style.height = '2px';
        particle.style.boxShadow = '0 0 5px 2px rgba(255, 0, 255, 0.7)';
      }
      
      // Position at center of screen, will be moved by transform
      particle.style.position = 'absolute';
      particle.style.left = `${centerX}px`;
      particle.style.top = `${centerY}px`;
      
      // Use transform to set initial scattered position
      particle.style.transform = `translate(${randomX - centerX}px, ${randomY - centerY}px)`;
      
      // Random animation delay for twinkling effect
      particle.style.animationDelay = `${Math.random() * 3}s`;
      
      // Add to container
      containerRef.current.appendChild(particle);
      
      // Store particle data
      particles.push({
        x: randomX,
        y: randomY,
        originalX: randomX,
        originalY: randomY,
        targetX: circleX,
        targetY: circleY,
        element: particle
      });
    }
    
    particlesRef.current = particles;
    
    // Add event listeners to input fields
    const inputFields = document.querySelectorAll('input');
    
    const handleFocus = () => {
      setIsAnimating(true);
      animateParticlesToCircle();
    };
    
    const handleBlur = () => {
      setIsAnimating(false);
      animateParticlesToScattered();
    };
    
    inputFields.forEach(input => {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
    });
    
    return () => {
      // Clean up event listeners
      inputFields.forEach(input => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      });
      
      // Cancel any ongoing animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  // Animate particles to circle formation
  const animateParticlesToCircle = () => {
    const particles = particlesRef.current;
    
    // Add rotation to container when in circle formation
    if (containerRef.current) {
      containerRef.current.style.animation = 'magentaParticlesRotate 120s linear infinite';
    }
    
    // Set up CSS transitions for each particle
    particles.forEach(particle => {
      // Calculate the target position relative to the center
      const targetX = particle.targetX - centerXRef.current;
      const targetY = particle.targetY - centerYRef.current;
      
      // Apply the animation
      particle.element.style.transition = 'transform 1s ease-out';
      particle.element.style.transform = `translate(${targetX}px, ${targetY}px)`;
    });
  };
  
  // Animate particles back to scattered positions
  const animateParticlesToScattered = () => {
    const particles = particlesRef.current;
    
    // Remove rotation from container when scattered
    if (containerRef.current) {
      containerRef.current.style.animation = 'none';
    }
    
    // Reset particles to their original scattered positions
    particles.forEach(particle => {
      // Calculate the original position relative to the center
      const originalX = particle.originalX - centerXRef.current;
      const originalY = particle.originalY - centerYRef.current;
      
      // Set transition for smooth animation back to original position
      particle.element.style.transition = 'transform 1s ease-out';
      particle.element.style.transform = `translate(${originalX}px, ${originalY}px)`;
    });
  };
  
  return (
    <div className="scattered-particles-container">
      <div 
        ref={containerRef} 
        className="relative w-full h-full"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10
        }}
      ></div>
    </div>
  );
}