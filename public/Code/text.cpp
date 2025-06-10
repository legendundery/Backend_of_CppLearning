#include <iostream>
using namespace std;
int func(int n){
 if(n>1){
 return n*func(n-1);
 }
 return n;
}

int main() {
  int a=5;
  int b = func(a);
  printf("%d\n",b);
  return 0;
}

