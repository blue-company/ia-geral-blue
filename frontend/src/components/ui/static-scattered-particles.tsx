"use client"

import { useEffect, useRef } from 'react';

export function StaticScatteredParticles() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear any existing particles
    containerRef.current.innerHTML = '';
    
    // Get window dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Create particles
    const particleCount = 300; // Number of particles
    
    for (let i = 0; i < particleCount; i++) {
      // Random position across the screen
      const randomX = Math.random() * windowWidth;
      const randomY = Math.random() * windowHeight;
      
      // Create particle element
      const particle = document.createElement('div');
      particle.className = 'magenta-particle';
      
      // Make some particles larger for better visibility
      if (Math.random() > 0.8) {
        particle.style.width = '2px';
        particle.style.height = '2px';
        particle.style.boxShadow = '0 0 5px 2px rgba(255, 0, 255, 0.7)';
      }
      
      // Position at random location
      particle.style.position = 'absolute';
      particle.style.left = `${randomX}px`;
      particle.style.top = `${randomY}px`;
      
      // Random animation delay for twinkling effect
      particle.style.animationDelay = `${Math.random() * 3}s`;
      
      // Add to container
      containerRef.current.appendChild(particle);
    }
    
    // Handle window resize
    const handleResize = () => {
      if (containerRef.current) {
        // Clear particles
        containerRef.current.innerHTML = '';
        
        // Recreate particles with new dimensions
        const newWindowWidth = window.innerWidth;
        const newWindowHeight = window.innerHeight;
        
        for (let i = 0; i < particleCount; i++) {
          const randomX = Math.random() * newWindowWidth;
          const randomY = Math.random() * newWindowHeight;
          
          const particle = document.createElement('div');
          particle.className = 'magenta-particle';
          
          if (Math.random() > 0.8) {
            particle.style.width = '2px';
            particle.style.height = '2px';
            particle.style.boxShadow = '0 0 5px 2px rgba(255, 0, 255, 0.7)';
          }
          
          particle.style.position = 'absolute';
          particle.style.left = `${randomX}px`;
          particle.style.top = `${randomY}px`;
          
          particle.style.animationDelay = `${Math.random() * 3}s`;
          
          containerRef.current.appendChild(particle);
        }
      }
    };
    
    // Add resize event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
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