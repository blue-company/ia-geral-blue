"use client"

import { useEffect, useRef } from 'react';

export function MagentaParticlesCircle() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear any existing particles
    containerRef.current.innerHTML = '';
    
    // Container dimensions
    const containerWidth = 400;
    const containerHeight = 400;
    
    // Create particles
    const particleCount = 300; // Number of particles
    const radius = containerWidth / 2; // Radius of the circle
    
    for (let i = 0; i < particleCount; i++) {
      // Calculate position on a circle
      // Use a slightly randomized radius to create a ring effect
      const randomRadius = radius * (0.7 + Math.random() * 0.3);
      
      // Random angle around the circle (in radians)
      const angle = Math.random() * Math.PI * 2;
      
      // Convert polar coordinates to Cartesian
      const x = Math.cos(angle) * randomRadius;
      const y = Math.sin(angle) * randomRadius;
      
      // Create particle element
      const particle = document.createElement('div');
      particle.className = 'magenta-particle';
      
      // Position at center of container + calculated offset
      particle.style.left = `${containerWidth / 2 + x}px`;
      particle.style.top = `${containerHeight / 2 + y}px`;
      
      // Random animation delay for twinkling effect
      particle.style.animationDelay = `${Math.random() * 3}s`;
      
      // Add to container
      containerRef.current.appendChild(particle);
    }
    
    // Add slow rotation to the entire container
    containerRef.current.style.animation = 'magentaParticlesRotate 120s linear infinite';
    
  }, []);
  
  return (
    <div className="magenta-particles-container">
      <div 
        ref={containerRef} 
        className="relative w-[400px] h-[400px]"
        style={{ 
          position: 'absolute',
          top: '35%',
          left: '50%',
          marginTop: '-200px',
          marginLeft: '-200px',
        }}
      ></div>
    </div>
  );
}