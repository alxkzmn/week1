pragma circom 2.0.3;

template Multiplier3 () {  

   // Declaration of signals.  
   signal input a;  
   signal input b;
   signal input c;
   signal output d;  

   signal intermediate;
   intermediate <== a*b;
   // Constraints.  
   d <== intermediate * c;  
}

component main = Multiplier3();