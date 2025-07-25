//
// Programmer      
//
// Date init       14.12.2004
//
// Reviser         $Author:: Dktochpe                                        $
//
// Revision date   $Date:: 5-08-05 9:30                                      $
//
// Filename        $Workfile:: d_sound.c                                     $
//
// Version         $Revision:: 10                                            $
//
// Archive         $Archive:: /LMS2006/Sys01/Main/Firmware/Source/d_sound.c  $
//
// Platform        C
//

#include  "stdconst.h"
#include  "m_sched.h"
#include  "d_sound.h"
#include  "d_sound.r"


void      dSoundInit(void)
{
  SOUNDInit;
}


void      dSoundVolume(UBYTE Step)
{
  SOUNDVolume(Step);
}


UBYTE     dSoundReady(void)
{
  return (SOUNDReady);
}


UBYTE     dSoundStart(UBYTE *pSound,UWORD Length,UWORD SampleRate)
{
  return (SOUNDStart(pSound,Length,SampleRate));
}


UBYTE     dSoundStop(void)
{
  return (SOUNDStop);
}


UBYTE     dSoundTone(UBYTE *pMelody,UWORD Length,UBYTE Volume)
{
  return (SOUNDTone(pMelody,Length,Volume));
}


void      dSoundFreq(UWORD Hz,UWORD mS,UBYTE Volume)
{
  SOUNDFreq(Hz,mS,Volume);
}


void      dSoundExit(void)
{
  SOUNDExit;
}
